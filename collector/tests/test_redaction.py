"""
test_redaction.py — Tests 1-4 of the Stage 3 exit gate.

Test 1: Seeded secrets never appear in the payload or egress log.
Test 2: Non-allowed fields are dropped before they reach the payload.
Test 3: Failed-login scan returns ONLY count + window_s + risk_level.
Test 4: Egress log SHA-256 matches the stored JSON exactly.
"""
import hashlib
import json
import os
import sys
from pathlib import Path

import pytest

# Allow running from project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from collector.payload_builder import build_payload, get_egress_entry
from collector.log_scanner import scan_failed_logins
from collector.redactor import redact

FIXTURE_LOG = Path(__file__).parent / "fixtures" / "sample.log"


# ── Test 1 ────────────────────────────────────────────────────────────────────

def test_seeded_secrets_not_in_payload():
    """
    Build a payload whose raw input contains the seeded secrets from sample.log.
    None of the plaintext secrets must appear in the serialised payload.
    """
    # Mimic a raw data dict that contains log-sourced strings
    raw = {
        "schema_version": "1.0",
        "payload_id": "test-secret-01",
        "tenant_id": "tenant_test",
        "collector_id": "col_test_01",
        "collector_version": "0.3.0",
        "source_id": "src_0000000001",
        "source_role": "employee_laptop",
        "seq": 1,
        "event_time_utc": "2026-11-20T14:00:00Z",
        "sent_time_utc": "2026-11-20T14:00:00Z",
        "source_timezone": "UTC",
        "config_version": "1.0",
        "heartbeat": {"uptime_s": 100, "buffer_depth": 0},
        "metrics": {
            "cpu_percent": 25.0,
            "memory_percent": 50.0,
            "disk_percent": 60.0,
            "net_latency_ms": 20.0,
            "packet_loss_percent": 0.0,
            "bandwidth_in_kbps": 500.0,
            "bandwidth_out_kbps": 200.0,
            "service_up": True,
            # Inject secrets as if they leaked into a free-text metric description
            "_raw_log": "password=SuperSecret123 api_key=sk-prod-abc123xyz789 john.doe@example.com 192.168.1.42",
        },
        "security": {
            "auth_failure_count": 6,
            "window_s": 60,
            "risk_level": "medium",
        },
        "local_health": {"state": "good", "reasons": []},
        "alerts": [],
        # Extra forbidden fields with secrets
        "username": "john.doe@example.com",
        "password": "SuperSecret123",
        "api_key": "sk-prod-abc123xyz789",
        "ip_address": "192.168.1.42",
    }

    payload_dict, json_bytes, sha256 = build_payload(raw)
    payload_str = json.dumps(payload_dict)
    egress_str = json_bytes.decode("utf-8")

    # None of the seeded secrets must appear anywhere in the payload
    assert "SuperSecret123" not in payload_str, "Password leaked into payload"
    assert "SuperSecret123" not in egress_str, "Password leaked into egress bytes"
    assert "sk-prod-abc123xyz789" not in payload_str, "API key leaked into payload"
    assert "sk-prod-abc123xyz789" not in egress_str, "API key leaked into egress bytes"
    assert "john.doe@example.com" not in payload_str, "Email leaked into payload"
    assert "john.doe@example.com" not in egress_str, "Email leaked into egress bytes"
    assert "192.168.1.42" not in payload_str, "IP leaked into payload"
    assert "192.168.1.42" not in egress_str, "IP leaked into egress bytes"


# ── Test 2 ────────────────────────────────────────────────────────────────────

def test_non_allowed_field_dropped():
    """
    A field not in the allow-list must NOT appear in the built payload.
    """
    raw = {
        "schema_version": "1.0",
        "payload_id": "test-allowlist-01",
        "tenant_id": "tenant_test",
        "collector_id": "col_test_01",
        "collector_version": "0.3.0",
        "source_id": "src_0000000001",
        "source_role": "employee_laptop",
        "seq": 2,
        "event_time_utc": "2026-11-20T14:00:01Z",
        "sent_time_utc": "2026-11-20T14:00:01Z",
        "source_timezone": "UTC",
        "config_version": "1.0",
        "heartbeat": {"uptime_s": 50, "buffer_depth": 0},
        "metrics": {
            "cpu_percent": 10.0,
            "memory_percent": 30.0,
            "disk_percent": 40.0,
            "net_latency_ms": 10.0,
            "packet_loss_percent": 0.0,
            "bandwidth_in_kbps": 100.0,
            "bandwidth_out_kbps": 50.0,
            "service_up": True,
        },
        "security": {
            "auth_failure_count": 0,
            "window_s": 60,
            "risk_level": "none",
        },
        "local_health": {"state": "excellent", "reasons": []},
        "alerts": [],
        # Forbidden fields that MUST be dropped
        "username": "admin",
        "hostname": "server-01",
        "command_line": "rm -rf /",
        "raw_log": "some raw log line",
        "free_text": "arbitrary data",
    }

    payload_dict, json_bytes, _ = build_payload(raw)
    payload_str = json.dumps(payload_dict)

    forbidden = ["username", "hostname", "command_line", "raw_log", "free_text"]
    for field in forbidden:
        assert field not in payload_dict, f"Forbidden field '{field}' found in payload dict"


# ── Test 3 ────────────────────────────────────────────────────────────────────

def test_failed_login_count_only():
    """
    scan_failed_logins must return exactly {count, window_s, risk_level}.
    No usernames, IPs, or raw log content.
    """
    result = scan_failed_logins(FIXTURE_LOG)

    # Exact set of keys
    assert set(result.keys()) == {"count", "window_s", "risk_level"}, (
        f"Unexpected keys in scan result: {set(result.keys())}"
    )

    # Types
    assert isinstance(result["count"], int), "count must be int"
    assert isinstance(result["window_s"], int), "window_s must be int"
    assert isinstance(result["risk_level"], str), "risk_level must be str"

    # Fixture has 6 failed logins
    assert result["count"] == 6, f"Expected 6 failed logins, got {result['count']}"

    # risk_level must be a valid enum value
    valid_levels = {"none", "low", "medium", "high", "critical"}
    assert result["risk_level"] in valid_levels, f"Invalid risk_level: {result['risk_level']}"

    # No IP addresses in any value
    import re
    ip_pattern = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')
    for v in result.values():
        assert not ip_pattern.search(str(v)), f"IP address found in result value: {v}"


# ── Test 4 ────────────────────────────────────────────────────────────────────

def test_egress_log_hash_matches():
    """
    The SHA-256 stored in the egress log must equal SHA-256(json_text).
    """
    raw = {
        "schema_version": "1.0",
        "payload_id": "test-hash-check-01",
        "tenant_id": "tenant_hash_test",
        "collector_id": "col_hash_01",
        "collector_version": "0.3.0",
        "source_id": "src_0000000001",
        "source_role": "web_server",
        "seq": 3,
        "event_time_utc": "2026-11-20T14:00:02Z",
        "sent_time_utc": "2026-11-20T14:00:02Z",
        "source_timezone": "UTC",
        "config_version": "1.0",
        "heartbeat": {"uptime_s": 200, "buffer_depth": 1},
        "metrics": {
            "cpu_percent": 55.0,
            "memory_percent": 70.0,
            "disk_percent": 80.0,
            "net_latency_ms": 50.0,
            "packet_loss_percent": 1.5,
            "bandwidth_in_kbps": 1024.0,
            "bandwidth_out_kbps": 512.0,
            "service_up": True,
        },
        "security": {
            "auth_failure_count": 2,
            "window_s": 60,
            "risk_level": "low",
        },
        "local_health": {"state": "fair", "reasons": ["high_cpu"]},
        "alerts": [],
    }

    payload_dict, json_bytes, returned_sha256 = build_payload(raw)
    payload_id = payload_dict.get("payload_id", "test-hash-check-01")

    # Read back from egress log
    entry = get_egress_entry(payload_id)
    assert entry is not None, f"No egress log entry found for {payload_id}"

    stored_sha256 = entry["sha256"]
    stored_json_text = entry["json_text"]

    # Recompute hash from stored text
    recomputed = hashlib.sha256(stored_json_text.encode("utf-8")).hexdigest()

    assert stored_sha256 == recomputed, (
        f"Hash mismatch: stored={stored_sha256} recomputed={recomputed}"
    )
    assert stored_sha256 == returned_sha256, (
        f"Returned SHA256 differs from egress log: returned={returned_sha256} stored={stored_sha256}"
    )
