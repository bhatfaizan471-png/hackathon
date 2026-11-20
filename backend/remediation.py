import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from backend.firestore_client import get_db

router = APIRouter()

class RemediationRequest(BaseModel):
    tenant_id: str
    incident_id: str
    action: str
    approved_by: str

APPROVED_ACTIONS = {
    "scale_worker_pool": {
        "policy": "ALLOW_AUTOSCALE_UP_TO_MAX_4",
        "rollback_plan": "Revert autoscaling pool max_instances back to 2",
        "description": "Simulated scaling of container replicas from 2 to 4",
    },
    "restart_runaway_worker": {
        "policy": "ALLOW_GRACEFUL_SERVICE_RESTART",
        "rollback_plan": "Failover to hot-standby node if restart takes >30s",
        "description": "Simulated graceful restart of background worker thread",
    },
}

@router.post("/v1/remediation/execute")
def execute_remediation(req: RemediationRequest):
    """
    Executes a simulated remediation:
    1. Validates that requested action passes policy check.
    2. Enforces simulation mode: NO REAL COMMAND OR PROCESS IS EXECUTED.
    3. Records immutable audit entry under tenants/{tenantId}/audit/{auditId}.
    4. Returns audit details and rollback plan.
    """
    if req.action not in APPROVED_ACTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Action '{req.action}' not in approved remediation templates: {list(APPROVED_ACTIONS.keys())}",
        )

    action_meta = APPROVED_ACTIONS[req.action]
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    audit_id = f"aud_{uuid.uuid4().hex[:12]}"

    audit_entry = {
        "id": audit_id,
        "tenant_id": req.tenant_id,
        "incident_id": req.incident_id,
        "action": req.action,
        "description": action_meta["description"],
        "approved_by": req.approved_by,
        "policy_check": "PASSED (" + action_meta["policy"] + ")",
        "simulated": True,
        "real_execution": False,
        "rollback_plan": action_meta["rollback_plan"],
        "time_utc": now_iso,
    }

    db = get_db()
    if db:
        db.collection(f"tenants/{req.tenant_id}/audit").document(audit_id).set(audit_entry)

    return {
        "status": "simulated_success",
        "audit_id": audit_id,
        "policy_check": audit_entry["policy_check"],
        "rollback_plan": audit_entry["rollback_plan"],
        "simulated": True,
    }
