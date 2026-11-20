"""
test_scenario_injection.py — Test scenario injection against live backend:
1. Brief bump (CPU 55%) -> No alert
2. Sustained CPU spike -> Generates alert
3. Multiple related alerts on same host -> Correlates into Incident
"""
import requests
import hashlib
import json
import time
from datetime import datetime, timezone
from backend.seed import DEMO_SECRETS
from backend.firestore_client import get_db

INGEST_URL = "http://127.0.0.1:8000/v1/ingest"

def send_payload(collector_id: str, tenant_id: str, source_id: str, cpu: float, latency: float = 25.0, loss: float = 0.2, fails: int = 0):
    key = DEMO_SECRETS[collector_id]
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    pid = f"test_{int(time.time() * 1000)}_{int(time.monotonic() * 1000)}"
    payload = {
        "schema_version": "1.0",
        "payload_id": pid,
        "tenant_id": tenant_id,
        "collector_id": collector_id,
        "collector_version": "0.3.0",
        "source_id": source_id,
        "source_role": "web_server",
        "customer_facing": "login",
        "seq": 1,
        "event_time_utc": now_iso,
        "sent_time_utc": now_iso,
        "source_timezone": "UTC",
        "config_version": "1.0",
        "heartbeat": {"uptime_s": 100, "buffer_depth": 0, "simulated": True},
        "metrics": {
            "cpu_percent": cpu,
            "memory_percent": 45.0,
            "disk_percent": 40.0,
            "net_latency_ms": latency,
            "packet_loss_percent": loss,
            "bandwidth_in_kbps": 200.0,
            "bandwidth_out_kbps": 100.0,
            "service_up": True,
        },
        "security": {"auth_failure_count": fails, "window_s": 60, "risk_level": "none"},
        "local_health": {"state": "good", "reasons": []},
        "alerts": [],
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    sha256 = hashlib.sha256(body_bytes).hexdigest()
    headers = {
        "Authorization": f"Bearer {key}",
        "X-Collector-Id": collector_id,
        "X-Payload-SHA256": sha256,
        "Content-Type": "application/json",
    }
    resp = requests.post(INGEST_URL, data=body_bytes, headers=headers, timeout=5)
    return resp.status_code, resp.json()

def run():
    print("--- 1. Establishing baseline for col_sim_web_01 (30% CPU) ---")
    for _ in range(5):
        send_payload("col_sim_web_01", "tenant_acme_demo", "src_b2c3d4e5f6", cpu=30.0)
        time.sleep(0.5)

    print("\n--- 2. Injecting brief bump (55% CPU) ---")
    st, res = send_payload("col_sim_web_01", "tenant_acme_demo", "src_b2c3d4e5f6", cpu=55.0)
    print(f"Brief bump response: HTTP {st} -> {res}")

    print("\n--- 3. Injecting sustained CPU spike (96.5% CPU) ---")
    for i in range(2):
        st, res = send_payload("col_sim_web_01", "tenant_acme_demo", "src_b2c3d4e5f6", cpu=96.5)
        print(f"Sustained CPU sample {i+1}: HTTP {st} -> {res}")
        time.sleep(0.5)

    print("\n--- 4. Injecting correlated Network Latency spike (185ms) on same host ---")
    st, res = send_payload("col_sim_web_01", "tenant_acme_demo", "src_b2c3d4e5f6", cpu=96.5, latency=185.0)
    print(f"Correlated network sample: HTTP {st} -> {res}")

    time.sleep(1)
    db = get_db()
    print("\n=== Real Firestore Stored Alerts (tenant_acme_demo) ===")
    alerts = list(db.collection("tenants/tenant_acme_demo/alerts").stream())
    for a in alerts:
        print(json.dumps(a.to_dict(), indent=2))

    print("\n=== Real Firestore Stored Incidents (tenant_acme_demo) ===")
    incidents = list(db.collection("tenants/tenant_acme_demo/incidents").stream())
    for inc in incidents:
        print(json.dumps(inc.to_dict(), indent=2))

if __name__ == "__main__":
    run()
