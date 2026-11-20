"""
test_sqlite_buffer.py — Test 5: SQLite queue survives restart and resumes in order.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from collector.sqlite_buffer import SQLiteBuffer


def _make_buf(path: Path) -> SQLiteBuffer:
    """Create a fresh SQLiteBuffer at *path*."""
    return SQLiteBuffer(path)


def test_sqlite_survives_restart_and_resumes_in_order():
    """
    1. Enqueue 3 items into an SQLite buffer.
    2. Destroy the buffer object (simulates process exit).
    3. Create a new SQLiteBuffer pointing at the same file (simulates restart).
    4. Confirm all 3 items are still present and in original insertion order.
    5. get_due() returns them all.
    6. mark_sent on each; confirm all are marked sent.

    Uses ignore_cleanup_errors=True (Python 3.12) to avoid Windows
    file-lock errors when TemporaryDirectory tries to delete WAL journals.
    """
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "test_buffer.sqlite"

        # --- Phase 1: enqueue items ---
        buf1 = _make_buf(db_path)
        buf1.enqueue("pid-001", '{"x":1}', "sha001")
        buf1.enqueue("pid-002", '{"x":2}', "sha002")
        buf1.enqueue("pid-003", '{"x":3}', "sha003")

        assert buf1.pending_count() == 3

        # --- Simulate restart: drop buf1, open buf2 on same file ---
        del buf1

        buf2 = _make_buf(db_path)

        # All 3 items must still be present
        rows = buf2.all_rows()
        assert len(rows) == 3, f"Expected 3 rows after restart, got {len(rows)}"

        # Must be in insertion order
        ids = [r["payload_id"] for r in rows]
        assert ids == ["pid-001", "pid-002", "pid-003"], f"Order wrong: {ids}"

        # get_due returns all (next_retry_at was set to now at enqueue time)
        due = buf2.get_due()
        assert len(due) == 3, f"Expected 3 due items, got {len(due)}"

        due_ids = [r["payload_id"] for r in due]
        assert due_ids == ["pid-001", "pid-002", "pid-003"], f"Due order wrong: {due_ids}"

        # Mark all sent
        for row in due:
            buf2.mark_sent(row["payload_id"])

        # Confirm none pending
        assert buf2.pending_count() == 0

        # Confirm all sent
        final_rows = buf2.all_rows()
        statuses = {r["payload_id"]: r["status"] for r in final_rows}
        for pid in ["pid-001", "pid-002", "pid-003"]:
            assert statuses[pid] == "sent", f"{pid} not marked sent: {statuses[pid]}"


def test_exponential_backoff_increases_delay():
    """
    mark_failed with increment_attempts=True should increase next_retry_at
    further into the future with each call (exponential backoff).
    """
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "backoff_test.sqlite"
        buf = _make_buf(db_path)
        buf.enqueue("pid-backoff", '{"y":1}', "shaBF")

        # First failure: attempts goes 0→1, delay = 2^1 * 5 = 10s
        buf.mark_failed("pid-backoff", increment_attempts=True)
        rows = buf.all_rows()
        assert rows[0]["attempts"] == 1
        retry1 = rows[0]["next_retry_at"]

        # Second failure: attempts goes 1→2, delay = 2^2 * 5 = 20s
        buf.mark_failed("pid-backoff", increment_attempts=True)
        rows = buf.all_rows()
        assert rows[0]["attempts"] == 2
        retry2 = rows[0]["next_retry_at"]

        # retry2 must be later than retry1
        assert retry2 > retry1, f"Backoff did not increase: {retry1} vs {retry2}"
