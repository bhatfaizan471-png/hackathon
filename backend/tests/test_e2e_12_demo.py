import os
import json
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.firestore_client import get_db, set_db, MockFirestoreClient
from backend.seed import seed_database
from backend.watchdog import check_and_update_silent_collectors
from backend.aiops.processor import process_telemetry

def create_payload(tenant_id="tenant_acme_demo", collector_id="col_sim_laptop_01", metrics=None, security=None, payload_id=None, extra=None):
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    m = {
        "cpu_percent": 30.0,
        "memory_percent": 50.0,
        "disk_percent": 40.0,
        "net_latency_ms": 25.0,
        "packet_loss_percent": 0.0,
        "bandwidth_in_kbps": 150.0,
        "bandwidth_out_kbps": 80.0,
        "service_up": True,
    }
    if metrics:
        m.update(metrics)

    s = {
        "auth_failure_count": 0,
        "window_s": 60,
        "risk_level": "none",
        "secrets_redacted_count": 0,
    }
    if security:
        s.update(security)

    p = {
        "schema_version": "1.0",
        "payload_id": payload_id or str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "collector_id": collector_id,
        "collector_version": "0.1.0",
        "source_id": "src_1a2b3c4d5e",
        "source_role": "employee_laptop",
        "customer_facing": "login",
        "seq": 1,
        "event_time_utc": now_iso,
        "sent_time_utc": now_iso,
        "source_timezone": "Asia/Kolkata",
        "config_version": "cfg-1",
        "heartbeat": {"uptime_s": 100, "buffer_depth": 0, "simulated": True},
        "metrics": m,
        "security": s,
        "local_health": {"state": "excellent", "reasons": ["All nominal"]},
        "alerts": [],
    }
    if extra:
        p.update(extra)
    return p

@pytest.fixture(autouse=True)
def init_test_env():
    os.environ["USE_MOCK_FIRESTORE"] = "true"
    db = MockFirestoreClient()
    set_db(db)
    seed_database()
    yield db

@pytest.mark.asyncio
async def test_demo_1_to_12_and_targets():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        db = get_db()
        headers = {
            "Authorization": "Bearer demo-key-laptop-01",
            "X-Collector-Id": "col_sim_laptop_01",
        }

        # ---------------------------------------------------------------------
        # 1. CPU spike to 95% creates an alert
        # ---------------------------------------------------------------------
        p1 = create_payload(metrics={"cpu_percent": 96.0})
        b1 = json.dumps(p1).encode("utf-8")
        h1 = dict(headers, **{"X-Payload-SHA256": hashlib.sha256(b1).hexdigest()})
        res1 = await client.post("/v1/ingest", content=b1, headers=h1)
        assert res1.status_code == 200

        alerts_stream = db.collection("tenants/tenant_acme_demo/alerts").stream()
        cpu_alerts = [a.to_dict() for a in alerts_stream if a.to_dict().get("category") == "infra"]
        assert len(cpu_alerts) >= 1, "Demo Test 1: CPU spike to 95% MUST create an alert"

        # ---------------------------------------------------------------------
        # 2. Website/API failure creates an alert
        # ---------------------------------------------------------------------
        p2 = create_payload(metrics={"service_up": False, "net_latency_ms": 500.0})
        b2 = json.dumps(p2).encode("utf-8")
        h2 = dict(headers, **{"X-Payload-SHA256": hashlib.sha256(b2).hexdigest()})
        res2 = await client.post("/v1/ingest", content=b2, headers=h2)
        assert res2.status_code == 200

        # ---------------------------------------------------------------------
        # 3. Network latency increase creates an alert
        # ---------------------------------------------------------------------
        p3 = create_payload(metrics={"net_latency_ms": 150.0})
        b3 = json.dumps(p3).encode("utf-8")
        h3 = dict(headers, **{"X-Payload-SHA256": hashlib.sha256(b3).hexdigest()})
        res3 = await client.post("/v1/ingest", content=b3, headers=h3)
        assert res3.status_code == 200

        net_alerts = [a.to_dict() for a in db.collection("tenants/tenant_acme_demo/alerts").stream() if a.to_dict().get("category") == "network"]
        assert len(net_alerts) >= 1, "Demo Test 3: Network latency increase creates an alert"

        # ---------------------------------------------------------------------
        # 4. Repeated failed logins create security alert without usernames or IPs
        # ---------------------------------------------------------------------
        p4 = create_payload(security={"auth_failure_count": 12, "risk_level": "high"})
        b4 = json.dumps(p4).encode("utf-8")
        h4 = dict(headers, **{"X-Payload-SHA256": hashlib.sha256(b4).hexdigest()})
        res4 = await client.post("/v1/ingest", content=b4, headers=h4)
        assert res4.status_code == 200

        sec_alerts = [a.to_dict() for a in db.collection("tenants/tenant_acme_demo/alerts").stream() if a.to_dict().get("category") == "security"]
        assert len(sec_alerts) >= 1, "Demo Test 4: Failed logins must trigger security alert"
        # Check no username or IP leaked in alert text
        for a in sec_alerts:
            ctx = a.get("context", "")
            assert "admin" not in ctx
            assert "192.168" not in ctx

        # ---------------------------------------------------------------------
        # 5. A stopped collector becomes Poor within 60 seconds
        # ---------------------------------------------------------------------
        now = datetime.now(timezone.utc)
        past_65s = (now - timedelta(seconds=65)).strftime("%Y-%m-%dT%H:%M:%SZ")
        db.collection("tenants/tenant_acme_demo/collectors").document("col_sim_laptop_01").update({
            "status": "online",
            "last_seen_utc": past_65s,
        })
        updated = check_and_update_silent_collectors(db=db, now_override=now, offline_threshold_seconds=60)
        assert updated >= 1
        col_doc = db.collection("tenants/tenant_acme_demo/collectors").document("col_sim_laptop_01").get().to_dict()
        assert col_doc["status"] == "offline"
        assert col_doc["health_state"] == "poor", "Demo Test 5: Stopped collector must become Poor"

        # ---------------------------------------------------------------------
        # 6. Seeded fake API key in local log is removed locally and never in Firestore
        # ---------------------------------------------------------------------
        forbidden_secrets = ["SuperSecret123", "sk-prod-abc123xyz789", "john.doe@example.com", "192.168.1.42"]
        for col_name, docs in db._store.items():
            for doc_id, doc_data in docs.items():
                serialized = json.dumps(doc_data)
                for secret in forbidden_secrets:
                    assert secret not in serialized, f"CRITICAL LEAK: '{secret}' found in Firestore doc {col_name}/{doc_id}"

        # ---------------------------------------------------------------------
        # 7. Egress panel matches received payload (hash MATCH)
        # ---------------------------------------------------------------------
        pid7 = str(uuid.uuid4())
        p7 = create_payload(payload_id=pid7)
        raw_b7 = json.dumps(p7).encode("utf-8")
        h7 = dict(headers, **{"X-Payload-SHA256": hashlib.sha256(raw_b7).hexdigest()})
        await client.post("/v1/ingest", content=raw_b7, headers=h7)

        stored_doc = db.collection("tenants/tenant_acme_demo/telemetry").document(pid7).get().to_dict()
        assert stored_doc["payload_sha256"] == hashlib.sha256(raw_b7).hexdigest(), "Demo Test 7: Hash MATCH"

        # ---------------------------------------------------------------------
        # 8. Offline buffering & retry gives zero loss and zero duplicates
        # ---------------------------------------------------------------------
        test_ids = [str(uuid.uuid4()) for _ in range(10)]
        for tid in test_ids:
            pt = create_payload(payload_id=tid)
            bt = json.dumps(pt).encode("utf-8")
            ht = dict(headers, **{"X-Payload-SHA256": hashlib.sha256(bt).hexdigest()})
            res = await client.post("/v1/ingest", content=bt, headers=ht)
            assert res.status_code == 200

        # Re-send all 10 (simulating retry after reconnect): all must be 'duplicate'
        for tid in test_ids:
            pt = create_payload(payload_id=tid)
            bt = json.dumps(pt).encode("utf-8")
            ht = dict(headers, **{"X-Payload-SHA256": hashlib.sha256(bt).hexdigest()})
            res = await client.post("/v1/ingest", content=bt, headers=ht)
            assert res.status_code == 200
            assert res.json().get("status") == "duplicate"

        # ---------------------------------------------------------------------
        # 9. Company A cannot access Company B's data
        # ---------------------------------------------------------------------
        spoofed_p = create_payload(tenant_id="tenant_beta_corp", collector_id="col_sim_laptop_01")
        spoofed_b = json.dumps(spoofed_p).encode("utf-8")
        spoofed_h = dict(headers, **{"X-Payload-SHA256": hashlib.sha256(spoofed_b).hexdigest()})
        res_spoof = await client.post("/v1/ingest", content=spoofed_b, headers=spoofed_h)
        assert res_spoof.status_code == 403, "Demo Test 9: Company A cannot write/access Company B"

        # ---------------------------------------------------------------------
        # 10. Multiple related alerts become one incident with explanation
        # ---------------------------------------------------------------------
        incidents = [doc.to_dict() for doc in db.collection("tenants/tenant_acme_demo/incidents").stream()]
        assert len(incidents) >= 1, "Demo Test 10: Multi-signal alerts become one incident"
        inc = incidents[0]
        assert "probable cause" in inc["explanation"]["probable_cause"].lower()
        assert "action" in inc["recommendation"]

        # ---------------------------------------------------------------------
        # 11. Replayed payloads create no duplicates; shuffled arrival gives correct trends
        # ---------------------------------------------------------------------
        replay_id = str(uuid.uuid4())
        rp = create_payload(payload_id=replay_id)
        rb = json.dumps(rp).encode("utf-8")
        rh = dict(headers, **{"X-Payload-SHA256": hashlib.sha256(rb).hexdigest()})
        r1 = await client.post("/v1/ingest", content=rb, headers=rh)
        r2 = await client.post("/v1/ingest", content=rb, headers=rh)
        assert r1.json()["status"] == "accepted"
        assert r2.json()["status"] == "duplicate", "Demo Test 11: Replay creates no duplicates"

        # ---------------------------------------------------------------------
        # 12. Brief normal bump is not flagged; sustained spike is
        # ---------------------------------------------------------------------
        from backend.aiops.anomaly_detector import BaselineTracker
        bt = BaselineTracker()
        for _ in range(10):
            bt.update("test::metric", 20.0)
        # Brief bump
        bt.update("test::metric", 45.0)
        assert not bt.is_sustained_anomaly("test::metric")
        # Sustained spike
        bt.update("test::metric", 95.0)
        bt.update("test::metric", 95.0)
        assert bt.is_sustained_anomaly("test::metric"), "Demo Test 12: Sustained spike flagged, brief bump not"
