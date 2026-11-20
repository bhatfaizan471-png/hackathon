import hashlib
import json
import uuid
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app

def make_valid_payload(tenant_id="tenant_acme_demo", collector_id="col_sim_laptop_01", payload_id=None, extra=None):
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    p = {
        "schema_version": "1.0",
        "payload_id": payload_id or str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "collector_id": collector_id,
        "collector_version": "0.1.0",
        "source_id": "src_1a2b3c4d5e",
        "source_role": "employee_laptop",
        "customer_facing": None,
        "seq": 100,
        "event_time_utc": now_iso,
        "sent_time_utc": now_iso,
        "source_timezone": "Asia/Kolkata",
        "config_version": "cfg-1",
        "heartbeat": {"uptime_s": 3600, "buffer_depth": 0, "simulated": True},
        "metrics": {
            "cpu_percent": 35.5,
            "memory_percent": 50.0,
            "disk_percent": 45.0,
            "net_latency_ms": 22.0,
            "packet_loss_percent": 0.0,
            "bandwidth_in_kbps": 120.0,
            "bandwidth_out_kbps": 60.0,
            "service_up": True,
        },
        "security": {
            "auth_failure_count": 0,
            "window_s": 60,
            "risk_level": "none",
            "secrets_redacted_count": 0,
        },
        "local_health": {
            "state": "excellent",
            "reasons": ["All metrics within normal bounds"],
        },
        "alerts": [],
    }
    if extra:
        p.update(extra)
    return p

@pytest.mark.asyncio
async def test_1_bad_or_missing_api_key_returns_401():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = make_valid_payload()
        body = json.dumps(payload).encode("utf-8")

        # Missing auth header
        res_no_auth = await client.post("/v1/ingest", content=body, headers={"X-Collector-Id": "col_sim_laptop_01"})
        assert res_no_auth.status_code == 401, f"Expected 401, got {res_no_auth.status_code}"

        # Bad key
        res_bad_key = await client.post(
            "/v1/ingest",
            content=body,
            headers={
                "Authorization": "Bearer totally-wrong-key",
                "X-Collector-Id": "col_sim_laptop_01",
            },
        )
        assert res_bad_key.status_code == 401

@pytest.mark.asyncio
async def test_2_tenant_mismatch_returns_403():
    """Collector col_sim_laptop_01 belongs to tenant_acme_demo. Spoofing tenant_beta_corp must fail."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        spoofed_payload = make_valid_payload(tenant_id="tenant_beta_corp", collector_id="col_sim_laptop_01")
        body = json.dumps(spoofed_payload).encode("utf-8")
        headers = {
            "Authorization": "Bearer demo-key-laptop-01",
            "X-Collector-Id": "col_sim_laptop_01",
            "X-Payload-SHA256": hashlib.sha256(body).hexdigest(),
        }
        res = await client.post("/v1/ingest", content=body, headers=headers)
        assert res.status_code == 403, f"Expected 403 Forbidden on tenant spoof, got {res.status_code}: {res.text}"

@pytest.mark.asyncio
async def test_3_idempotent_duplicate_payload():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        fixed_id = str(uuid.uuid4())
        payload = make_valid_payload(payload_id=fixed_id)
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": "Bearer demo-key-laptop-01",
            "X-Collector-Id": "col_sim_laptop_01",
            "X-Payload-SHA256": hashlib.sha256(body).hexdigest(),
        }

        # First ingest: accepted
        res1 = await client.post("/v1/ingest", content=body, headers=headers)
        assert res1.status_code == 200
        assert res1.json().get("status") == "accepted"

        # Duplicate ingest: duplicate
        res2 = await client.post("/v1/ingest", content=body, headers=headers)
        assert res2.status_code == 200
        assert res2.json().get("status") == "duplicate"

@pytest.mark.asyncio
async def test_4_out_of_order_payloads_store_event_time_utc():
    from backend.firestore_client import get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        past_time = "2026-11-20T10:00:00Z"
        pid = str(uuid.uuid4())
        payload = make_valid_payload(payload_id=pid, extra={"event_time_utc": past_time})
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": "Bearer demo-key-laptop-01",
            "X-Collector-Id": "col_sim_laptop_01",
            "X-Payload-SHA256": hashlib.sha256(body).hexdigest(),
        }
        res = await client.post("/v1/ingest", content=body, headers=headers)
        assert res.status_code == 200

        # Verify stored doc has event_time_utc preserved exactly
        db = get_db()
        doc = db.collection("tenants/tenant_acme_demo/telemetry").document(pid).get()
        assert doc.exists
        stored = doc.to_dict()
        assert stored["event_time_utc"] == past_time
        assert "received_time_utc" in stored

@pytest.mark.asyncio
async def test_5_unknown_fields_dropped_and_forbidden_rejected():
    from backend.firestore_client import get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 5a: Unknown field is dropped, not stored
        pid = str(uuid.uuid4())
        payload = make_valid_payload(payload_id=pid, extra={"unapproved_random_tag": "should_be_dropped"})
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Authorization": "Bearer demo-key-laptop-01",
            "X-Collector-Id": "col_sim_laptop_01",
            "X-Payload-SHA256": hashlib.sha256(body).hexdigest(),
        }
        res = await client.post("/v1/ingest", content=body, headers=headers)
        assert res.status_code == 200

        db = get_db()
        stored = db.collection("tenants/tenant_acme_demo/telemetry").document(pid).get().to_dict()
        assert "unapproved_random_tag" not in stored

        # 5b: Forbidden keyword (e.g. password, raw_log) is rejected with 422
        bad_payload = make_valid_payload(extra={"user_password": "secret_text"})
        bad_body = json.dumps(bad_payload).encode("utf-8")
        bad_headers = {
            "Authorization": "Bearer demo-key-laptop-01",
            "X-Collector-Id": "col_sim_laptop_01",
            "X-Payload-SHA256": hashlib.sha256(bad_body).hexdigest(),
        }
        res_bad = await client.post("/v1/ingest", content=bad_body, headers=bad_headers)
        assert res_bad.status_code == 422
