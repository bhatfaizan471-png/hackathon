#!/usr/bin/env python3
"""
Nexus Observe — Payload Validator
==================================
Validates a JSON payload against the allow-list schema defined in
config/allow_list.json.

Usage:
  python scripts/validate_payload.py path/to/payload.json
  python scripts/validate_payload.py --test

Exit codes:
  0 — valid
  1 — invalid (error messages printed to stderr)
"""

import json
import re
import sys
import uuid
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
ALLOW_LIST_PATH = REPO_ROOT / "config" / "allow_list.json"

# ---------------------------------------------------------------------------
# ISO 8601 UTC pattern  (e.g. 2026-11-20T14:22:05Z)
# ---------------------------------------------------------------------------
_ISO8601_UTC_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$"
)

# ---------------------------------------------------------------------------
# Top-level required fields (flat names as they appear in the JSON)
# ---------------------------------------------------------------------------
_REQUIRED_FLAT = [
    "schema_version",
    "payload_id",
    "tenant_id",
    "collector_id",
    "collector_version",
    "source_id",
    "source_role",
    # customer_facing is nullable/optional
    "seq",
    "event_time_utc",
    "sent_time_utc",
    "source_timezone",
    "config_version",
    "heartbeat",
    "metrics",
    "security",
    "local_health",
    "alerts",
]

# ---------------------------------------------------------------------------
# Sub-object required keys
# ---------------------------------------------------------------------------
_REQUIRED_HEARTBEAT = {"uptime_s", "buffer_depth"}
_REQUIRED_METRICS = {
    "cpu_percent", "memory_percent", "disk_percent",
    "net_latency_ms", "packet_loss_percent",
    "bandwidth_in_kbps", "bandwidth_out_kbps", "service_up",
}
_REQUIRED_SECURITY = {
    "auth_failure_count", "window_s", "risk_level", "secrets_redacted_count"
}
_REQUIRED_LOCAL_HEALTH = {"state", "reasons"}

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
_SOURCE_ROLE_ENUM = {
    "employee_laptop", "web_server", "database_server",
    "app_server", "network_device"
}
_RISK_LEVEL_ENUM = {"none", "low", "medium", "high", "critical"}
_HEALTH_STATE_ENUM = {"excellent", "good", "fair", "poor"}
_ALERT_CATEGORY_ENUM = {"infra", "network", "security", "collector"}
_ALERT_SEVERITY_ENUM = {"info", "low", "medium", "high", "critical"}

# ---------------------------------------------------------------------------
# Allow-list: forbidden keyword detection (never_send list)
# ---------------------------------------------------------------------------

def _load_allow_list() -> dict:
    with ALLOW_LIST_PATH.open() as f:
        return json.load(f)


def _get_all_top_level_keys(payload: dict, allow_list: dict) -> set:
    """Return the set of all top-level keys defined in the allow-list."""
    allowed = set()
    for field_path in allow_list["fields"]:
        top = field_path.split(".")[0].rstrip("[]")
        allowed.add(top)
    return allowed


# ---------------------------------------------------------------------------
# Validator
# ---------------------------------------------------------------------------

def validate(payload: dict, allow_list: dict) -> list[str]:
    """Return a list of error strings. Empty list means valid."""
    errors: list[str] = []

    # 1. Never-send forbidden keywords in top-level keys
    never_send = set(allow_list.get("never_send", []))
    for key in payload:
        if key in never_send:
            errors.append(f"Forbidden field present: '{key}'")

    # 2. Check for unknown top-level fields (not in allow-list)
    allowed_top_keys = _get_all_top_level_keys(payload, allow_list)
    for key in payload:
        if key not in allowed_top_keys:
            errors.append(f"Unknown / not-allowed field: '{key}'")

    # 3. Required top-level fields
    for field in _REQUIRED_FLAT:
        if field not in payload:
            errors.append(f"Missing required field: '{field}'")

    # If we already have missing-field errors, skip deep checks to avoid noise
    if errors:
        return errors

    # 4. schema_version
    if payload.get("schema_version") != "1.0":
        errors.append("'schema_version' must be \"1.0\"")

    # 5. payload_id — must be a valid UUID4
    try:
        pid = uuid.UUID(str(payload["payload_id"]), version=4)
        if str(pid) != payload["payload_id"].lower():
            raise ValueError
    except (ValueError, AttributeError):
        errors.append("'payload_id' must be a valid UUID4 string")

    # 6. source_id pattern
    src_id = payload.get("source_id", "")
    if not re.match(r"^src_[0-9a-f]{10}$", str(src_id)):
        errors.append(
            f"'source_id' must match ^src_[0-9a-f]{{10}}$ — got '{src_id}'"
        )

    # 7. source_role enum
    if payload.get("source_role") not in _SOURCE_ROLE_ENUM:
        errors.append(
            f"'source_role' must be one of {sorted(_SOURCE_ROLE_ENUM)}"
        )

    # 8. seq — non-negative integer
    seq = payload.get("seq")
    if not isinstance(seq, int) or isinstance(seq, bool) or seq < 0:
        errors.append("'seq' must be a non-negative integer")

    # 9. ISO 8601 UTC timestamps
    for ts_field in ("event_time_utc", "sent_time_utc"):
        val = payload.get(ts_field, "")
        if not _ISO8601_UTC_RE.match(str(val)):
            errors.append(
                f"'{ts_field}' must be ISO 8601 UTC with Z (e.g. 2026-11-20T14:22:05Z)"
            )

    # 10. heartbeat sub-object
    hb = payload.get("heartbeat", {})
    if not isinstance(hb, dict):
        errors.append("'heartbeat' must be an object")
    else:
        for k in _REQUIRED_HEARTBEAT:
            if k not in hb:
                errors.append(f"'heartbeat.{k}' is required")
            elif not isinstance(hb[k], int) or isinstance(hb[k], bool) or hb[k] < 0:
                errors.append(f"'heartbeat.{k}' must be a non-negative integer")

    # 11. metrics sub-object
    m = payload.get("metrics", {})
    if not isinstance(m, dict):
        errors.append("'metrics' must be an object")
    else:
        for k in _REQUIRED_METRICS - {"net_latency_ms", "service_up"}:
            if k not in m:
                errors.append(f"'metrics.{k}' is required")
            else:
                v = m[k]
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    errors.append(f"'metrics.{k}' must be a number")
                elif "percent" in k and not (0 <= v <= 100):
                    errors.append(f"'metrics.{k}' must be between 0 and 100")
                elif v < 0:
                    errors.append(f"'metrics.{k}' must be >= 0")
        # net_latency_ms (nullable)
        if "net_latency_ms" in m and m["net_latency_ms"] is not None:
            v = m["net_latency_ms"]
            if not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0:
                errors.append("'metrics.net_latency_ms' must be a non-negative number or null")
        # service_up — boolean
        if "service_up" not in m:
            errors.append("'metrics.service_up' is required")
        elif not isinstance(m["service_up"], bool):
            errors.append("'metrics.service_up' must be a boolean")

    # 12. security sub-object
    s = payload.get("security", {})
    if not isinstance(s, dict):
        errors.append("'security' must be an object")
    else:
        for k in ("auth_failure_count", "window_s", "secrets_redacted_count"):
            if k not in s:
                errors.append(f"'security.{k}' is required")
            else:
                v = s[k]
                min_val = 1 if k == "window_s" else 0
                if not isinstance(v, int) or isinstance(v, bool) or v < min_val:
                    errors.append(
                        f"'security.{k}' must be an integer >= {min_val}"
                    )
        if s.get("risk_level") not in _RISK_LEVEL_ENUM:
            errors.append(
                f"'security.risk_level' must be one of {sorted(_RISK_LEVEL_ENUM)}"
            )

    # 13. local_health sub-object
    lh = payload.get("local_health", {})
    if not isinstance(lh, dict):
        errors.append("'local_health' must be an object")
    else:
        if lh.get("state") not in _HEALTH_STATE_ENUM:
            errors.append(
                f"'local_health.state' must be one of {sorted(_HEALTH_STATE_ENUM)}"
            )
        reasons = lh.get("reasons", [])
        if not isinstance(reasons, list):
            errors.append("'local_health.reasons' must be an array")
        elif len(reasons) > 5:
            errors.append("'local_health.reasons' may have at most 5 items")
        else:
            for i, r in enumerate(reasons):
                if not isinstance(r, str) or len(r) > 120:
                    errors.append(
                        f"'local_health.reasons[{i}]' must be a string <= 120 chars"
                    )

    # 14. alerts array
    alerts = payload.get("alerts", [])
    max_alerts = allow_list.get("max_alerts_per_payload", 10)
    if not isinstance(alerts, list):
        errors.append("'alerts' must be an array")
    elif len(alerts) > max_alerts:
        errors.append(f"'alerts' may have at most {max_alerts} items")
    else:
        for i, a in enumerate(alerts):
            if not isinstance(a, dict):
                errors.append(f"'alerts[{i}]' must be an object")
                continue
            if a.get("category") not in _ALERT_CATEGORY_ENUM:
                errors.append(
                    f"'alerts[{i}].category' must be one of {sorted(_ALERT_CATEGORY_ENUM)}"
                )
            if a.get("severity") not in _ALERT_SEVERITY_ENUM:
                errors.append(
                    f"'alerts[{i}].severity' must be one of {sorted(_ALERT_SEVERITY_ENUM)}"
                )
            ctx = a.get("context", "")
            if not isinstance(ctx, str) or len(ctx) > 140:
                errors.append(
                    f"'alerts[{i}].context' must be a string <= 140 chars"
                )

    return errors


# ---------------------------------------------------------------------------
# Inline test suite
# ---------------------------------------------------------------------------
_VALID_PAYLOAD = {
    "schema_version": "1.0",
    "payload_id": "7b0f6f5e-3a52-4d0b-9f66-0c1d4e5f6a7b",
    "tenant_id": "tenant_acme_demo",
    "collector_id": "col_demo_laptop_01",
    "collector_version": "0.1.0",
    "source_id": "src_a1b2c3d4e5",
    "source_role": "web_server",
    "customer_facing": "login",
    "seq": 1234,
    "event_time_utc": "2026-11-20T14:22:05Z",
    "sent_time_utc": "2026-11-20T14:22:05Z",
    "source_timezone": "Asia/Kolkata",
    "config_version": "cfg-1",
    "heartbeat": {"uptime_s": 86400, "buffer_depth": 0},
    "metrics": {
        "cpu_percent": 42.5,
        "memory_percent": 61.2,
        "disk_percent": 55.0,
        "net_latency_ms": 38.0,
        "packet_loss_percent": 0.0,
        "bandwidth_in_kbps": 420.0,
        "bandwidth_out_kbps": 180.0,
        "service_up": True,
    },
    "security": {
        "auth_failure_count": 12,
        "window_s": 60,
        "risk_level": "high",
        "secrets_redacted_count": 1,
    },
    "local_health": {
        "state": "fair",
        "reasons": ["auth_failure_count above 5 per minute"],
    },
    "alerts": [
        {
            "category": "security",
            "severity": "high",
            "context": "12 failed logins in 60 s",
        }
    ],
}

_FORBIDDEN_FIELD_PAYLOAD = {
    **_VALID_PAYLOAD,
    "payload_id": "8c1f7a6b-4b63-5e1c-af77-1d2e5f6a7b8c",  # different UUID
    "username": "john.doe",          # forbidden field
    "ip_address": "192.168.1.100",   # forbidden field
}

_MISSING_REQUIRED_PAYLOAD = {
    # Deliberately omits: tenant_id, collector_id, heartbeat, metrics
    "schema_version": "1.0",
    "payload_id": "9d2e8b7c-5c74-6f2d-b088-2e3f6a7b8c9d",
    "source_id": "src_a1b2c3d4e5",
    "source_role": "employee_laptop",
    "seq": 1,
    "event_time_utc": "2026-11-20T14:22:05Z",
    "sent_time_utc": "2026-11-20T14:22:05Z",
    "source_timezone": "UTC",
    "config_version": "cfg-1",
    "collector_version": "0.1.0",
    "security": {
        "auth_failure_count": 0,
        "window_s": 60,
        "risk_level": "none",
        "secrets_redacted_count": 0,
    },
    "local_health": {"state": "good", "reasons": []},
    "alerts": [],
}


def run_tests(allow_list: dict) -> bool:
    """Run 3 inline tests. Returns True if all pass."""
    all_passed = True

    # Test 1 — valid payload (expect 0 errors)
    print("[TEST 1/3] Valid payload                ...", end=" ", flush=True)
    errors = validate(_VALID_PAYLOAD, allow_list)
    if not errors:
        print("PASS  (exit 0 — no errors)")
    else:
        print("FAIL  (unexpected errors):")
        for e in errors:
            print(f"       • {e}")
        all_passed = False

    # Test 2 — forbidden field (expect >=1 error)
    print("[TEST 2/3] Extra forbidden field        ...", end=" ", flush=True)
    errors = validate(_FORBIDDEN_FIELD_PAYLOAD, allow_list)
    if errors:
        print("PASS  (exit 1 — forbidden field detected)")
        for e in errors:
            print(f"       • {e}")
    else:
        print("FAIL  (should have been rejected but was accepted)")
        all_passed = False

    # Test 3 — missing required fields (expect >=1 error)
    print("[TEST 3/3] Missing required field       ...", end=" ", flush=True)
    errors = validate(_MISSING_REQUIRED_PAYLOAD, allow_list)
    if errors:
        print("PASS  (exit 1 — required field missing)")
        for e in errors:
            print(f"       • {e}")
    else:
        print("FAIL  (should have been rejected but was accepted)")
        all_passed = False

    if all_passed:
        print("\nAll 3 tests passed.")
    else:
        print("\nSome tests FAILED.", file=sys.stderr)

    return all_passed


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main() -> int:
    allow_list = _load_allow_list()

    if len(sys.argv) == 2 and sys.argv[1] == "--test":
        ok = run_tests(allow_list)
        return 0 if ok else 1

    if len(sys.argv) != 2:
        print(
            "Usage:\n"
            "  python scripts/validate_payload.py path/to/payload.json\n"
            "  python scripts/validate_payload.py --test",
            file=sys.stderr,
        )
        return 1

    payload_path = Path(sys.argv[1])
    if not payload_path.exists():
        print(f"Error: file not found: {payload_path}", file=sys.stderr)
        return 1

    with payload_path.open() as f:
        try:
            payload = json.load(f)
        except json.JSONDecodeError as exc:
            print(f"Error: invalid JSON: {exc}", file=sys.stderr)
            return 1

    errors = validate(payload, allow_list)
    if not errors:
        print(f"OK  {payload_path} is valid.")
        return 0
    else:
        print(f"INVALID  {payload_path} has {len(errors)} error(s):", file=sys.stderr)
        for e in errors:
            print(f"  • {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
