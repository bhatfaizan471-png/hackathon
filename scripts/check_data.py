"""
Data Verification Tool for Nexus Observe.
Inspects whether data has been added to the SaaS database (telemetry, collectors, alerts).
Usage:
    python scripts/check_data.py
    python scripts/check_data.py --send-test
"""
import sys
from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import json
import uuid
import time
import hashlib
import requests
from datetime import datetime, timezone

BACKEND_URL = "http://127.0.0.1:8000"
DEMO_KEY = "demo-key-laptop-01"
COLLECTOR_ID = "col_sim_laptop_01"
TENANT_ID = "tenant_acme_demo"

def send_test_payload():
    """Sends a single valid test telemetry payload to the backend."""
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    payload_id = str(uuid.uuid4())
    payload = {
        "schema_version": "1.0",
        "payload_id": payload_id,
        "tenant_id": TENANT_ID,
        "collector_id": COLLECTOR_ID,
        "collector_version": "0.1.0",
        "source_id": "src_1a2b3c4d5e",
        "source_role": "employee_laptop",
        "customer_facing": "login",
        "seq": int(time.time()),
        "event_time_utc": now_iso,
        "sent_time_utc": now_iso,
        "source_timezone": "Asia/Kolkata",
        "config_version": "cfg-1",
        "heartbeat": {"uptime_s": 500, "buffer_depth": 0, "simulated": True},
        "metrics": {
            "cpu_percent": 45.2,
            "memory_percent": 58.0,
            "disk_percent": 42.0,
            "net_latency_ms": 28.5,
            "packet_loss_percent": 0.0,
            "bandwidth_in_kbps": 220.0,
            "bandwidth_out_kbps": 95.0,
            "service_up": True,
        },
        "security": {
            "auth_failure_count": 1,
            "window_s": 60,
            "risk_level": "none",
            "secrets_redacted_count": 0,
        },
        "local_health": {
            "state": "excellent",
            "reasons": ["Manual test verification payload"],
        },
        "alerts": [],
    }

    body = json.dumps(payload).encode("utf-8")
    sha256 = hashlib.sha256(body).hexdigest()

    headers = {
        "Authorization": f"Bearer {DEMO_KEY}",
        "X-Collector-Id": COLLECTOR_ID,
        "X-Payload-SHA256": sha256,
        "Content-Type": "application/json",
    }

    print(f"--> Sending test telemetry payload to {BACKEND_URL}/v1/ingest...")
    print(f"    Payload ID: {payload_id}")
    print(f"    Tenant:     {TENANT_ID}")
    print(f"    Collector:  {COLLECTOR_ID}")

    try:
        resp = requests.post(f"{BACKEND_URL}/v1/ingest", data=body, headers=headers, timeout=5.0)
        if resp.status_code == 200:
            res_data = resp.json()
            print(f"  [SUCCESS] Ingest ACCEPTED! Status: {res_data.get('status')}")
            print(f"  [SUCCESS] SHA-256 Egress Hash: {sha256}\n")
            return payload_id
        else:
            print(f"  [FAIL] Backend returned HTTP {resp.status_code}: {resp.text}\n")
            return None
    except Exception as e:
        print(f"  [ERROR] Could not connect to backend at {BACKEND_URL}: {e}\n")
        return None

def check_database_data():
    """Checks data in the database via the backend or Firestore client."""
    print("=" * 65)
    print("       NEXUS OBSERVE — DATA INGESTION & STORAGE CHECKER       ")
    print("=" * 65)

    # 1. Check via Backend API endpoint (/v1/data-summary)
    api_success = False
    try:
        summary_resp = requests.get(f"{BACKEND_URL}/v1/data-summary?tenant_id={TENANT_ID}", timeout=3.0)
        if summary_resp.status_code == 200:
            api_success = True
            data = summary_resp.json()
            counts = data.get("counts", {})
            print("[SaaS Backend API Check] Live query for tenant: 'tenant_acme_demo':")
            print(f"  • Telemetry Documents:  {counts.get('telemetry', 0)} stored")
            print(f"  • Registered Hosts:     {counts.get('collectors', 0)} online")
            print(f"  • Active Alerts:        {counts.get('alerts', 0)} raised")
            print(f"  • Correlated Incidents: {counts.get('incidents', 0)} active")

            latest = data.get("latest_telemetry")
            if latest:
                print("\n[Latest Telemetry Stored in Database]")
                print(f"  • Document ID:     {latest.get('payload_id')}")
                print(f"  • Timestamp (UTC): {latest.get('event_time_utc')}")
                print(f"  • Host / Source:   {latest.get('source_id')} ({latest.get('source_role')})")
                print(f"  • CPU / Memory:    {latest.get('metrics', {}).get('cpu_percent')}% / {latest.get('metrics', {}).get('memory_percent')}%")
                print(f"  • Net Latency:     {latest.get('metrics', {}).get('net_latency_ms')} ms")
                print(f"  • Egress SHA-256:  {latest.get('payload_sha256')}")
                print(f"  • Ingest Latency:  {latest.get('ingest_latency_ms')} ms")
            else:
                print("\n[Notice] No telemetry payloads recorded yet.")
                print("  Send one now using: python scripts/check_data.py --send-test")
    except Exception as e:
        print(f"[Backend API Note] Could not fetch summary via HTTP: {e}")

    # 2. Check direct Firestore client if API was not checked
    if not api_success:
        try:
            from backend.firestore_client import get_db
            db = get_db()
            print("\n[Direct Firestore Check] Inspecting documents in memory/emulator...")
            docs = list(db.collection(f"tenants/{TENANT_ID}/telemetry").stream())
            print(f"  • Telemetry Points: {len(docs)} document(s)")
        except Exception as e:
            print(f"  • Note: {e}")

    print("\n" + "=" * 65)

if __name__ == "__main__":
    if "--send-test" in sys.argv:
        send_test_payload()
    check_database_data()
