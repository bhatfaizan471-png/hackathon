"""
test_collector_send.py — Test network send, error backoff recovery, and FIFO ordering.

Tests:
1. Collector sends due items to stub server with required headers (Authorization, X-Collector-Id, X-Payload-SHA256, Content-Type).
2. Forced failure keeps items pending with exponential backoff without dropping or reordering.
3. Recovery sends all items in exact FIFO order; asserts sent IDs equal received IDs with no duplicates.
4. HTTP 200 duplicate response marks item sent and egress sent.
5. Network error (connection failure) keeps items pending without loss.
"""
from __future__ import annotations

import hashlib
import http.server
import json
import os
import sys
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.seed import DEMO_SECRETS
from collector.collector import send_due_items
from collector.payload_builder import _init_egress_db, build_payload, get_egress_entry
from collector.sqlite_buffer import SQLiteBuffer


class _StubIngestHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/v1/ingest":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # Forced server failure scenario
        if getattr(self.server, "force_failure", False):
            self.server.failure_count += 1
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error": "forced_server_failure"}')
            return

        # Validate headers
        auth = self.headers.get("Authorization")
        cid = self.headers.get("X-Collector-Id")
        sha = self.headers.get("X-Payload-SHA256")
        ctype = self.headers.get("Content-Type")

        computed_sha = hashlib.sha256(body).hexdigest()
        assert sha == computed_sha, f"SHA mismatch: header={sha} computed={computed_sha}"
        assert ctype == "application/json", f"Wrong Content-Type: {ctype}"
        assert auth is not None and auth.startswith("Bearer "), f"Missing/bad Authorization: {auth}"
        assert cid is not None, "Missing X-Collector-Id"

        data = json.loads(body.decode("utf-8"))
        pid = data["payload_id"]

        self.server.received_requests.append({
            "payload_id": pid,
            "collector_id": cid,
            "auth": auth,
            "sha256": sha,
            "data": data,
        })

        resp_status = getattr(self.server, "return_status", "accepted")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": resp_status, "payload_id": pid}).encode("utf-8"))

    def log_message(self, format, *args):
        # Silence HTTP server access log in pytest output
        pass


@pytest.fixture
def stub_server():
    server = http.server.HTTPServer(("127.0.0.1", 0), _StubIngestHandler)
    server.received_requests = []
    server.failure_count = 0
    server.force_failure = False
    server.return_status = "accepted"

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/v1/ingest"

    yield server, url

    server.shutdown()
    server.server_close()


def _make_test_payload(pid: str, collector_id: str = "col_sim_laptop_01", tenant_id: str = "tenant_acme_demo") -> dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "schema_version": "1.0",
        "payload_id": pid,
        "tenant_id": tenant_id,
        "collector_id": collector_id,
        "collector_version": "0.3.0",
        "source_id": f"src_{collector_id}",
        "source_role": "employee_laptop",
        "seq": 1,
        "event_time_utc": now_iso,
        "sent_time_utc": now_iso,
        "source_timezone": "UTC",
        "config_version": "1.0",
        "heartbeat": {"uptime_s": 42, "buffer_depth": 0},
        "metrics": {
            "cpu_percent": 35.0,
            "memory_percent": 45.0,
            "disk_percent": 55.0,
            "net_latency_ms": 15.2,
            "packet_loss_percent": 0.0,
            "service_up": True,
        },
        "security": {
            "auth_failure_count": 0,
            "window_s": 60,
            "risk_level": "none",
        },
        "local_health": {"state": "good", "reasons": []},
        "alerts": [],
    }


def test_collector_send_failure_recovery_and_no_duplicates(stub_server, monkeypatch):
    """
    Test requirement:
    - Runs the collector against a stub server.
    - Forces a failure.
    - Recovers.
    - Asserts sent IDs equal received IDs with no duplicates.
    """
    server, ingest_url = stub_server

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "test_buffer.sqlite"
        egress_db_path = Path(tmpdir) / "test_egress.sqlite"
        monkeypatch.setattr("collector.payload_builder.EGRESS_DB_PATH", egress_db_path)
        _init_egress_db()

        buffer = SQLiteBuffer(db_path)

        # Prepare 3 sequential payloads
        expected_ids = ["pid-stub-001", "pid-stub-002", "pid-stub-003"]
        for pid in expected_ids:
            raw = _make_test_payload(pid, collector_id="col_sim_laptop_01")
            pdict, jbytes, sha = build_payload(raw)
            buffer.enqueue(pdict["payload_id"], jbytes.decode("utf-8"), sha)

        assert buffer.pending_count() == 3

        # ── Step 1: Force a failure ──
        server.force_failure = True

        sent_during_fail = send_due_items(
            buffer=buffer,
            ingest_url=ingest_url,
            simulate=True,
        )

        # Nothing should be marked sent
        assert sent_during_fail == 0
        assert server.failure_count == 1
        assert len(server.received_requests) == 0

        # All 3 items must still be in the buffer (never dropped)
        assert buffer.pending_count() == 3

        # The first item should have incremented attempts
        rows_after_fail = buffer.all_rows()
        assert rows_after_fail[0]["attempts"] == 1
        assert rows_after_fail[0]["status"] == "pending"

        # ── Step 2: Recover ──
        server.force_failure = False

        # Reset next_retry_at to now for test execution so we don't need wall-clock sleep
        # while keeping real backoff logic intact
        now_iso = datetime.now(timezone.utc).isoformat()
        with buffer._connect() as conn:
            conn.execute("UPDATE queue SET next_retry_at = ?", (now_iso,))
            conn.commit()

        sent_after_recovery = send_due_items(
            buffer=buffer,
            ingest_url=ingest_url,
            simulate=True,
        )

        assert sent_after_recovery == 3
        assert buffer.pending_count() == 0

        # Assert sent IDs equal received IDs in exact FIFO order
        received_ids = [r["payload_id"] for r in server.received_requests]
        assert received_ids == expected_ids, f"Mismatch: expected {expected_ids}, got {received_ids}"

        # Assert no duplicates
        assert len(received_ids) == len(set(received_ids)), "Duplicate payloads detected!"

        # Verify simulated credentials from DEMO_SECRETS
        for req in server.received_requests:
            assert req["auth"] == f"Bearer {DEMO_SECRETS['col_sim_laptop_01']}"
            assert req["collector_id"] == "col_sim_laptop_01"

        # Verify egress entries are marked sent
        for pid in expected_ids:
            entry = get_egress_entry(pid)
            assert entry is not None
            assert entry["status"] == "sent"
            assert entry["sent_time_utc"] is not None


def test_collector_send_real_mode_uses_provided_credentials(stub_server, monkeypatch):
    """Real mode uses COLLECTOR_ID and COLLECTOR_KEY passed from .env."""
    server, ingest_url = stub_server

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "real_mode_buffer.sqlite"
        egress_db_path = Path(tmpdir) / "real_mode_egress.sqlite"
        monkeypatch.setattr("collector.payload_builder.EGRESS_DB_PATH", egress_db_path)
        _init_egress_db()

        buffer = SQLiteBuffer(db_path)

        custom_id = "col_custom_office_pc"
        custom_key = "custom-secret-key-xyz"

        raw = _make_test_payload("pid-real-001", collector_id=custom_id)
        pdict, jbytes, sha = build_payload(raw)
        buffer.enqueue(pdict["payload_id"], jbytes.decode("utf-8"), sha)

        sent = send_due_items(
            buffer=buffer,
            ingest_url=ingest_url,
            simulate=False,
            collector_id=custom_id,
            collector_key=custom_key,
        )

        assert sent == 1
        assert len(server.received_requests) == 1
        req = server.received_requests[0]
        assert req["collector_id"] == custom_id
        assert req["auth"] == f"Bearer {custom_key}"


def test_collector_send_duplicate_response_marks_sent(stub_server, monkeypatch):
    """HTTP 200 with duplicate status should be marked sent in buffer and egress."""
    server, ingest_url = stub_server
    server.return_status = "duplicate"

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "dup_buffer.sqlite"
        egress_db_path = Path(tmpdir) / "dup_egress.sqlite"
        monkeypatch.setattr("collector.payload_builder.EGRESS_DB_PATH", egress_db_path)
        _init_egress_db()

        buffer = SQLiteBuffer(db_path)

        raw = _make_test_payload("pid-dup-001")
        pdict, jbytes, sha = build_payload(raw)
        buffer.enqueue(pdict["payload_id"], jbytes.decode("utf-8"), sha)

        sent = send_due_items(
            buffer=buffer,
            ingest_url=ingest_url,
            simulate=True,
        )

        assert sent == 1
        assert buffer.pending_count() == 0
        entry = get_egress_entry("pid-dup-001")
        assert entry["status"] == "sent"


def test_collector_send_network_error_retains_pending(monkeypatch):
    """Network connection failure (e.g. unreachable host) keeps item pending."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "net_err_buffer.sqlite"
        egress_db_path = Path(tmpdir) / "net_err_egress.sqlite"
        monkeypatch.setattr("collector.payload_builder.EGRESS_DB_PATH", egress_db_path)
        _init_egress_db()

        buffer = SQLiteBuffer(db_path)

        raw = _make_test_payload("pid-net-err-001")
        pdict, jbytes, sha = build_payload(raw)
        buffer.enqueue(pdict["payload_id"], jbytes.decode("utf-8"), sha)

        # Unreachable local port
        unreachable_url = "http://127.0.0.1:59998/v1/ingest"

        sent = send_due_items(
            buffer=buffer,
            ingest_url=unreachable_url,
            simulate=True,
            timeout=0.5,
        )

        assert sent == 0
        assert buffer.pending_count() == 1
        row = buffer.all_rows()[0]
        assert row["status"] == "pending"
        assert row["attempts"] == 1
