"""
payload_builder.py — THE single chokepoint for outbound data.

Pipeline:
  1. Load allowed fields from config/allow_list.json
  2. Redact all string values in the raw input
  3. Filter: only copy fields that are in the allow-list
  4. Build final payload dict
  5. Serialize to JSON (sorted keys, separators=(',', ':'))
  6. Compute SHA-256 of the exact JSON bytes
  7. Write to egress log (SQLite)
  8. Return (payload_dict, payload_json_bytes, sha256_hex)
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Tuple

from collector.config import EGRESS_DB_PATH, load_allow_list
from collector.redactor import redact_value


# ── Egress log DB ─────────────────────────────────────────────────────────────

def _egress_connect() -> sqlite3.Connection:
    db_path = Path(EGRESS_DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def _init_egress_db():
    with _egress_connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS egress_log (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                payload_id      TEXT UNIQUE NOT NULL,
                json_text       TEXT NOT NULL,
                sha256          TEXT NOT NULL,
                event_time_utc  TEXT NOT NULL,
                sent_time_utc   TEXT,
                status          TEXT NOT NULL DEFAULT 'queued'
            )
        """)
        conn.commit()


_init_egress_db()


# ── Allow-list helpers ────────────────────────────────────────────────────────

def _get_allowed_fields() -> set[str]:
    """Return the set of top-level field names allowed to leave the collector."""
    al = load_allow_list()
    allowed: set[str] = set()
    for key in al.get("fields", {}):
        # heartbeat.uptime_s → "heartbeat"
        # alerts[].category → "alerts"
        top = key.split(".")[0].split("[")[0]
        allowed.add(top)
    return allowed


# ── Core build function ───────────────────────────────────────────────────────

def build_payload(raw: dict) -> Tuple[dict, bytes, str]:
    """
    Build, redact, filter, sign and log a payload.

    Parameters
    ----------
    raw : dict
        Raw collector data (may contain forbidden fields and secrets).

    Returns
    -------
    (payload_dict, json_bytes, sha256_hex)
    """
    allowed_top = _get_allowed_fields()

    # Step 1 + 2: redact string values, track count
    redacted_count = 0

    def _redact_deep(obj):
        nonlocal redacted_count
        if isinstance(obj, str):
            new_val, n = redact_value(obj)
            redacted_count += n
            return new_val
        if isinstance(obj, dict):
            return {k: _redact_deep(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_redact_deep(item) for item in obj]
        return obj

    redacted = _redact_deep(raw)

    # Step 3: filter to allowed top-level keys only
    filtered: dict = {}
    for key in allowed_top:
        if key in redacted:
            filtered[key] = redacted[key]

    # Step 4: embed secrets_redacted_count in security block if present
    if "security" not in filtered:
        filtered["security"] = {}
    if isinstance(filtered["security"], dict):
        filtered["security"]["secrets_redacted_count"] = redacted_count

    # Ensure payload_id is present
    if "payload_id" not in filtered:
        filtered["payload_id"] = str(uuid.uuid4())

    payload_dict = filtered

    # Step 5: serialize
    json_bytes: bytes = json.dumps(payload_dict, sort_keys=True, separators=(",", ":")).encode("utf-8")

    # Step 6: SHA-256
    sha256_hex: str = hashlib.sha256(json_bytes).hexdigest()

    # Step 7: write to egress log
    now_utc = datetime.now(timezone.utc).isoformat()
    payload_id = payload_dict.get("payload_id", str(uuid.uuid4()))
    with _egress_connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO egress_log
                (payload_id, json_text, sha256, event_time_utc, status)
            VALUES (?, ?, ?, ?, 'queued')
            """,
            (payload_id, json_bytes.decode("utf-8"), sha256_hex, now_utc),
        )
        conn.commit()

    return payload_dict, json_bytes, sha256_hex


def get_egress_entry(payload_id: str) -> sqlite3.Row | None:
    """Retrieve an egress log row by payload_id."""
    with _egress_connect() as conn:
        return conn.execute(
            "SELECT * FROM egress_log WHERE payload_id = ?",
            (payload_id,),
        ).fetchone()


def mark_egress_sent(payload_id: str):
    """Mark an egress entry as sent."""
    now_utc = datetime.now(timezone.utc).isoformat()
    with _egress_connect() as conn:
        conn.execute(
            "UPDATE egress_log SET status='sent', sent_time_utc=? WHERE payload_id=?",
            (now_utc, payload_id),
        )
        conn.commit()
