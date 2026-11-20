import hashlib
from typing import Optional
from fastapi import HTTPException, Header, status
from backend.firestore_client import get_db

async def verify_collector(
    authorization: Optional[str] = Header(None, description="Bearer <collector_key>"),
    x_collector_id: Optional[str] = Header(None, alias="X-Collector-Id"),
) -> dict:
    """
    Validates collector credentials:
    1. Checks for presence of Bearer token and X-Collector-Id header (returns 401 if missing)
    2. Hashes key using SHA-256
    3. Looks up collector_credentials/{collector_id} in Firestore
    4. Validates matching key_hash and active flag
    Returns dict with tenant_id and collector_id.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Bearer token",
        )

    if not x_collector_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Collector-Id header",
        )

    raw_key = authorization[7:].strip()
    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty collector key",
        )

    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    db = get_db()
    doc_ref = db.collection("collector_credentials").document(x_collector_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unknown collector ID",
        )

    data = doc.to_dict()
    if data.get("key_hash") != key_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid collector key",
        )

    if not data.get("active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Collector is disabled/inactive",
        )

    tenant_id = data.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Collector has no associated tenant",
        )

    return {
        "tenant_id": tenant_id,
        "collector_id": x_collector_id,
    }
