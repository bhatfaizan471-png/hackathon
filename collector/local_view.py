"""
local_view.py — CLI demo: last N entries from egress log.

Shows a 3-column table: RAW LOG LINE | REDACTED | PAYLOAD JSON SENT
Plus SHA-256 hash and MATCH/MISMATCH indicator.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import sys
from pathlib import Path

from collector.config import EGRESS_DB_PATH


def _fetch_last(n: int) -> list[sqlite3.Row]:
    db_path = Path(EGRESS_DB_PATH)
    if not db_path.exists():
        return []
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM egress_log ORDER BY id DESC LIMIT ?", (n,)
    ).fetchall()
    conn.close()
    return list(reversed(rows))


def show(n: int = 10):
    rows = _fetch_last(n)
    if not rows:
        print("No egress log entries found.")
        return

    sep = "-" * 120
    print(sep)
    print(f"{'PAYLOAD_ID':<40} {'SHA256 (first 16)':<20} {'MATCH':<8} STATUS")
    print(sep)
    for row in rows:
        stored_sha = row["sha256"]
        recomputed = hashlib.sha256(row["json_text"].encode("utf-8")).hexdigest()
        match = "✓ MATCH" if stored_sha == recomputed else "✗ MISMATCH"
        print(f"{row['payload_id']:<40} {stored_sha[:16]:<20} {match:<8} {row['status']}")
        # Pretty-print the JSON
        try:
            parsed = json.loads(row["json_text"])
            print("  PAYLOAD:", json.dumps(parsed, indent=2)[:300], "...")
        except Exception:
            print("  PAYLOAD (raw):", row["json_text"][:200])
        print()


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    show(n)
