"""
check.py — Connectivity and authentication verification for Nexus Observe Collector.

Usage:
    python -m collector.check
"""
import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv

# Find and load .env from cwd, collector directory, or parent
for env_candidate in [Path.cwd() / ".env", Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parent.parent / ".env"]:
    if env_candidate.exists():
        load_dotenv(env_candidate)
        break
else:
    load_dotenv()


def main() -> int:
    print("=" * 60)
    print("Nexus Observe Collector — Preflight Connectivity Check")
    print("=" * 60)

    # 1. Check required configuration
    tenant_id = os.getenv("TENANT_ID")
    collector_id = os.getenv("COLLECTOR_ID")
    collector_key = os.getenv("COLLECTOR_KEY")
    ingest_url = os.getenv("SAAS_INGEST_URL", "https://hackathon-2-09sm.onrender.com/v1/ingest")
    source_role = os.getenv("SOURCE_ROLE", "employee_laptop")

    missing = []
    if not tenant_id:
        missing.append("TENANT_ID")
    if not collector_id:
        missing.append("COLLECTOR_ID")
    if not collector_key:
        missing.append("COLLECTOR_KEY")

    if missing:
        print(f"FAIL: Missing required configuration in .env: {', '.join(missing)}")
        print("Please check your .env file or run setup.bat again.")
        return 1

    print(f"  Tenant ID      : {tenant_id}")
    print(f"  Collector ID   : {collector_id}")
    print(f"  Collector Key  : {'*' * (len(collector_key) - 4) + collector_key[-4:] if len(collector_key) >= 4 else '****'}")
    print(f"  Ingest URL     : {ingest_url}")
    print(f"  Source Role    : {source_role}")
    print("-" * 60)

    # 2. Network connectivity check
    parsed = urlparse(ingest_url)
    if not parsed.scheme or not parsed.netloc:
        print(f"FAIL: Invalid SAAS_INGEST_URL: '{ingest_url}'. Must be a valid HTTP/HTTPS URL.")
        return 1

    base_url = f"{parsed.scheme}://{parsed.netloc}"
    health_url = f"{base_url}/health"

    print(f"[*] Testing server connectivity at {health_url}...")
    try:
        resp = requests.get(health_url, timeout=10)
        if resp.status_code == 200:
            print(f"PASS: Backend service is reachable (HTTP 200).")
        else:
            print(f"WARNING: Server returned HTTP {resp.status_code} on /health, attempting ingest endpoint directly...")
    except requests.exceptions.RequestException as e:
        print(f"FAIL: Could not reach backend server at {base_url}.")
        print(f"Reason: {e}")
        print("Please check your internet connection or verify SAAS_INGEST_URL.")
        return 1

    import socket
    salt = os.getenv("SOURCE_ID_SALT", "nexus_salt_v1")
    hostname = socket.gethostname()
    valid_source_id = f"src_{hashlib.sha256(f'{salt}:{hostname}'.encode('utf-8')).hexdigest()[:10]}"

    # 3. Authenticate and test ingest with a lightweight heartbeat payload
    print(f"[*] Verifying collector authentication and tenant assignment...")
    test_payload = {
        "schema_version": "1.0",
        "payload_id": f"chk_{uuid.uuid4().hex[:12]}",
        "tenant_id": tenant_id,
        "collector_id": collector_id,
        "collector_version": os.getenv("COLLECTOR_VERSION", "0.3.0"),
        "source_id": valid_source_id,
        "source_role": source_role,
        "seq": 0,
        "event_time_utc": datetime.now(timezone.utc).isoformat(),
        "sent_time_utc": datetime.now(timezone.utc).isoformat(),
        "source_timezone": "UTC",
        "config_version": os.getenv("CONFIG_VERSION", "1.0"),
        "heartbeat": {"uptime_s": 1, "buffer_depth": 0},
        "metrics": {
            "cpu_percent": 1.0,
            "memory_percent": 1.0,
            "disk_percent": 1.0,
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

    body_bytes = json.dumps(test_payload).encode("utf-8")
    payload_sha256 = hashlib.sha256(body_bytes).hexdigest()

    headers = {
        "Authorization": f"Bearer {collector_key}",
        "X-Collector-Id": str(collector_id),
        "X-Payload-SHA256": payload_sha256,
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(ingest_url, data=body_bytes, headers=headers, timeout=12)
        if resp.status_code == 200:
            print("PASS: Authentication verified! Ingest accepted test payload (HTTP 200).")
            print("PASS: Tenant boundary and collector key validation succeeded.")
            print("=" * 60)
            print("SUCCESS: Collector is configured correctly and ready to run.")
            print("Run 'run_collector.bat' to start streaming privacy-safe telemetry.")
            print("=" * 60)
            return 0
        elif resp.status_code == 401:
            print("FAIL: Authentication failed (HTTP 401 Unauthorized).")
            print("Reason: Invalid COLLECTOR_KEY or COLLECTOR_ID.")
            print("Please confirm the key provided by your administrator.")
            return 1
        elif resp.status_code == 403:
            print("FAIL: Permission denied (HTTP 403 Forbidden).")
            print(f"Reason: Collector '{collector_id}' is not authorized for tenant '{tenant_id}'.")
            return 1
        elif resp.status_code == 422:
            print("FAIL: Payload rejected (HTTP 422 Unprocessable Entity).")
            print(f"Detail: {resp.text}")
            return 1
        else:
            print(f"FAIL: Ingest returned unexpected HTTP {resp.status_code}: {resp.text}")
            return 1
    except requests.exceptions.RequestException as e:
        print(f"FAIL: Request to {ingest_url} failed: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
