import json
import re
from typing import Tuple, Dict, Any, List
from backend.config import ALLOW_LIST_PATH

with open(ALLOW_LIST_PATH, "r", encoding="utf-8") as f:
    ALLOW_SPEC = json.load(f)

ALLOWED_FIELDS = ALLOW_SPEC.get("fields", {})
NEVER_SEND = ALLOW_SPEC.get("never_send", [])

REQUIRED_ROOT_FIELDS = [
    "schema_version",
    "payload_id",
    "tenant_id",
    "collector_id",
    "collector_version",
    "source_id",
    "source_role",
    "seq",
    "event_time_utc",
    "sent_time_utc",
    "source_timezone",
    "config_version",
    "heartbeat",
    "metrics",
    "local_health",
]

def validate_and_filter_payload(payload: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
    """
    Validates payload against allow-list and drops unknown fields.
    Returns (is_valid, errors, filtered_payload).
    """
    errors = []

    # Check for forbidden sensitive keywords in root keys
    for k in payload.keys():
        for forbidden in NEVER_SEND:
            if forbidden in k.lower():
                errors.append(f"Forbidden field detected in payload: {k}")

    # Check required fields
    for req in REQUIRED_ROOT_FIELDS:
        if req not in payload:
            errors.append(f"Missing required root field: '{req}'")

    if errors:
        return False, errors, {}

    # Check schema_version
    if payload.get("schema_version") != "1.0":
        errors.append(f"Unsupported schema_version: {payload.get('schema_version')}")

    # Check source_id pattern
    source_id = str(payload.get("source_id", ""))
    if not re.match(r"^src_[0-9a-f]{10}$", source_id):
        errors.append(f"Invalid source_id format: '{source_id}'")

    # Filter allowed fields (dropping any unapproved fields)
    filtered: Dict[str, Any] = {}
    for k, v in payload.items():
        if k in [
            "schema_version", "payload_id", "tenant_id", "collector_id",
            "collector_version", "source_id", "source_role", "customer_facing",
            "seq", "event_time_utc", "sent_time_utc", "source_timezone", "config_version"
        ]:
            filtered[k] = v
        elif k == "heartbeat" and isinstance(v, dict):
            hb = {}
            for sub_k in ["uptime_s", "buffer_depth", "simulated"]:
                if sub_k in v:
                    hb[sub_k] = v[sub_k]
            filtered["heartbeat"] = hb
        elif k == "metrics" and isinstance(v, dict):
            m = {}
            for sub_k in [
                "cpu_percent", "memory_percent", "disk_percent", "net_latency_ms",
                "packet_loss_percent", "bandwidth_in_kbps", "bandwidth_out_kbps", "service_up"
            ]:
                if sub_k in v:
                    m[sub_k] = v[sub_k]
            filtered["metrics"] = m
        elif k == "security" and isinstance(v, dict):
            sec = {}
            for sub_k in ["auth_failure_count", "window_s", "risk_level", "secrets_redacted_count"]:
                if sub_k in v:
                    sec[sub_k] = v[sub_k]
            filtered["security"] = sec
        elif k == "local_health" and isinstance(v, dict):
            lh = {}
            if "state" in v:
                lh["state"] = v["state"]
            if "reasons" in v and isinstance(v["reasons"], list):
                lh["reasons"] = [str(r)[:120] for r in v["reasons"][:5]]
            filtered["local_health"] = lh
        elif k == "alerts" and isinstance(v, list):
            valid_alerts = []
            for a in v[:10]:
                if isinstance(a, dict):
                    valid_alerts.append({
                        "category": a.get("category", "infra"),
                        "severity": a.get("severity", "info"),
                        "context": str(a.get("context", ""))[:140]
                    })
            filtered["alerts"] = valid_alerts

    return (len(errors) == 0), errors, filtered
