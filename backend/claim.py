"""
backend/claim.py — Secure tenant assignment endpoint.
Assigns tenant_id custom claim to authenticated Firebase users using a validated invite code.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

import firebase_admin
from firebase_admin import auth
from backend.firestore_client import get_db, run_transaction

router = APIRouter()

GENERIC_INVITE_ERROR = "Invalid or expired invite code"


class ClaimTenantRequest(BaseModel):
    invite_code: str = Field(..., min_length=1)


@router.post("/v1/claim-tenant")
def claim_tenant(payload: ClaimTenantRequest, authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    # 1. Verify Firebase ID token
    try:
        decoded_token = auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication token") from e

    uid = decoded_token.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid authentication token: missing uid")

    # 2. If the user already has a tenant_id claim -> 409, never change it
    if decoded_token.get("tenant_id"):
        raise HTTPException(status_code=409, detail="User already assigned to a tenant")

    # 3. Clean invite code: strip, uppercase, hash with SHA-256
    clean_code = payload.invite_code.strip().upper()
    code_hash = hashlib.sha256(clean_code.encode("utf-8")).hexdigest()

    db = get_db()
    invite_ref = db.collection("tenant_invites").document(code_hash)

    # 4. Atomic transaction to validate invite and increment used_count
    def _claim_tx(transaction):
        raw_snap = transaction.get(invite_ref)
        snap = next(iter(raw_snap), None) if not hasattr(raw_snap, "exists") else raw_snap
        if snap is None or not snap.exists:
            raise HTTPException(status_code=403, detail=GENERIC_INVITE_ERROR)

        doc_data = snap.to_dict() or {}
        if not doc_data.get("active", False):
            raise HTTPException(status_code=403, detail=GENERIC_INVITE_ERROR)

        max_uses = int(doc_data.get("max_uses", 1))
        used_count = int(doc_data.get("used_count", 0))
        if used_count >= max_uses:
            raise HTTPException(status_code=403, detail=GENERIC_INVITE_ERROR)

        expires_at_utc = doc_data.get("expires_at_utc")
        if expires_at_utc:
            try:
                exp_dt = datetime.fromisoformat(expires_at_utc.replace("Z", "+00:00"))
                now_dt = datetime.now(timezone.utc)
                if now_dt >= exp_dt:
                    raise HTTPException(status_code=403, detail=GENERIC_INVITE_ERROR)
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=403, detail=GENERIC_INVITE_ERROR)

        tenant_id = doc_data.get("tenant_id")
        if not tenant_id:
            raise HTTPException(status_code=403, detail=GENERIC_INVITE_ERROR)

        transaction.update(invite_ref, {"used_count": used_count + 1})
        return tenant_id

    tenant_id = run_transaction(db, _claim_tx)

    # 5. Set custom claim on user
    try:
        auth.set_custom_user_claims(uid, {"tenant_id": tenant_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to assign tenant claim") from e

    return {"tenant_id": tenant_id}
