"""
sqlite_buffer.py — SQLite-backed queue with exponential backoff retry.

Table: queue(id, payload_id, json_text, sha256, created_at, status, attempts, next_retry_at)
"""
import math
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _backoff_seconds(attempts: int, max_s: int = 300) -> float:
    return min(max_s, (2 ** attempts) * 5)


class SQLiteBuffer:
    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS queue (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    payload_id      TEXT UNIQUE NOT NULL,
                    json_text       TEXT NOT NULL,
                    sha256          TEXT NOT NULL,
                    created_at      TEXT NOT NULL,
                    status          TEXT NOT NULL DEFAULT 'pending',
                    attempts        INTEGER NOT NULL DEFAULT 0,
                    next_retry_at   TEXT NOT NULL
                )
            """)
            conn.commit()

    def enqueue(self, payload_id: str, json_text: str, sha256: str):
        """Insert a new pending item (idempotent: ignore if already exists)."""
        now = _now_utc()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO queue
                    (payload_id, json_text, sha256, created_at, status, attempts, next_retry_at)
                VALUES (?, ?, ?, ?, 'pending', 0, ?)
                """,
                (payload_id, json_text, sha256, now, now),
            )
            conn.commit()

    def get_due(self) -> list[sqlite3.Row]:
        """Return rows whose next_retry_at <= now and status = 'pending'."""
        now = _now_utc()
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM queue
                WHERE status = 'pending' AND next_retry_at <= ?
                ORDER BY id ASC
                """,
                (now,),
            ).fetchall()
        return rows

    def mark_sent(self, payload_id: str):
        """Mark a row as sent."""
        with self._connect() as conn:
            conn.execute(
                "UPDATE queue SET status = 'sent' WHERE payload_id = ?",
                (payload_id,),
            )
            conn.commit()

    def mark_failed(self, payload_id: str, increment_attempts: bool = True):
        """Mark a row as still-pending with backoff-adjusted next_retry_at."""
        with self._connect() as conn:
            row = conn.execute(
                "SELECT attempts FROM queue WHERE payload_id = ?",
                (payload_id,),
            ).fetchone()
            if row is None:
                return
            new_attempts = row["attempts"] + (1 if increment_attempts else 0)
            delay = _backoff_seconds(new_attempts)
            next_retry = datetime.now(timezone.utc)
            # Add delay in seconds
            from datetime import timedelta
            next_retry = next_retry + timedelta(seconds=delay)
            conn.execute(
                """
                UPDATE queue
                SET status = 'pending', attempts = ?, next_retry_at = ?
                WHERE payload_id = ?
                """,
                (new_attempts, next_retry.isoformat(), payload_id),
            )
            conn.commit()

    def pending_count(self) -> int:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM queue WHERE status = 'pending'"
            ).fetchone()
        return row[0]

    def all_rows(self) -> list[sqlite3.Row]:
        """Return all rows ordered by id — used by tests."""
        with self._connect() as conn:
            return conn.execute("SELECT * FROM queue ORDER BY id ASC").fetchall()

    def close(self):
        """No-op: connections are opened/closed per-operation. Present for test teardown."""
        pass
