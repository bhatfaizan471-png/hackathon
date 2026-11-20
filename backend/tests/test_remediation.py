import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.firestore_client import get_db

def test_remediation_approval_produces_audit_entry_and_rollback_text():
    client = TestClient(app)
    req_body = {
        "tenant_id": "tenant_acme_demo",
        "incident_id": "inc_src_1a2b3c4d5e_12345",
        "action": "scale_worker_pool",
        "approved_by": "lead_sre_operator@nexus-demo.local",
    }

    res = client.post("/v1/remediation/execute", json=req_body)
    assert res.status_code == 200
    data = res.json()

    # Verify simulation flags and policy checks
    assert data["status"] == "simulated_success"
    assert data["simulated"] is True
    assert "ALLOW_AUTOSCALE" in data["policy_check"]
    assert "Revert autoscaling" in data["rollback_plan"]

    # Verify audit record persisted in Firestore
    audit_id = data["audit_id"]
    db = get_db()
    doc = db.collection("tenants/tenant_acme_demo/audit").document(audit_id).get()
    assert doc.exists
    audit = doc.to_dict()
    assert audit["simulated"] is True
    assert audit["real_execution"] is False
    assert audit["approved_by"] == "lead_sre_operator@nexus-demo.local"
    assert "rollback_plan" in audit
