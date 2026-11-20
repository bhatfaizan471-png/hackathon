import hashlib
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends, HTTPException, status
from backend.auth import verify_collector
from backend.schema_validator import validate_and_filter_payload
from backend.firestore_client import get_db

router = APIRouter()

@router.post("/v1/ingest")
async def ingest(
    request: Request,
    cred: dict = Depends(verify_collector),
):
    """
    Ingest endpoint:
    1. Authenticates via Bearer key and X-Collector-Id header.
    2. Verifies SHA-256 header against body.
    3. Validates payload schema and drops unknown fields.
    4. Enforces strict server-side tenant isolation:
       payload['tenant_id'] must match the authenticated collector's tenant.
    5. Stores payload idempotently: payload_id is the doc ID.
       Returns 200 {"status": "duplicate"} if already exists.
    6. Updates collector status under tenants/{tenant_id}/collectors/{collector_id}.
    """
    body_bytes = await request.body()
    computed_sha256 = hashlib.sha256(body_bytes).hexdigest()

    # Verify X-Payload-SHA256 header if supplied
    header_sha = request.headers.get("X-Payload-SHA256")
    if header_sha and header_sha.lower() != computed_sha256.lower():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Payload SHA-256 does not match X-Payload-SHA256 header",
        )

    try:
        raw_payload = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid JSON body",
        )

    # 1. Validate against allow-list and drop unapproved fields
    is_valid, errors, filtered_payload = validate_and_filter_payload(raw_payload)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"errors": errors},
        )

    # 2. Strict tenant authorization check
    payload_tenant = filtered_payload.get("tenant_id")
    auth_tenant = cred.get("tenant_id")
    if payload_tenant != auth_tenant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant mismatch: collector is not authorized for tenant '{payload_tenant}'",
        )

    # 3. Collector identity match
    payload_collector = filtered_payload.get("collector_id")
    auth_collector = cred.get("collector_id")
    if payload_collector != auth_collector:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Collector ID mismatch: payload specifies '{payload_collector}' but auth is for '{auth_collector}'",
        )

    db = get_db()
    payload_id = filtered_payload["payload_id"]
    telemetry_ref = (
        db.collection(f"tenants/{auth_tenant}/telemetry")
        .document(payload_id)
    )

    # 4. Idempotency check: doc ID = payload_id
    existing_doc = telemetry_ref.get()
    if existing_doc.exists:
        return {"status": "duplicate", "payload_id": payload_id}

    # Calculate ingest latency
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    ingest_latency_ms = None
    sent_time_str = filtered_payload.get("sent_time_utc")
    if sent_time_str:
        try:
            sent_dt = datetime.fromisoformat(sent_time_str.replace("Z", "+00:00"))
            ingest_latency_ms = max(0.0, (now_utc - sent_dt).total_seconds() * 1000.0)
        except Exception:
            pass

    # Enrich document with audit metadata
    doc_data = dict(filtered_payload)
    doc_data["received_time_utc"] = now_iso
    doc_data["payload_sha256"] = computed_sha256
    doc_data["ingest_latency_ms"] = ingest_latency_ms

    # Write telemetry document
    telemetry_ref.set(doc_data)

    # 5. Update collector heartbeat & status
    collector_ref = (
        db.collection(f"tenants/{auth_tenant}/collectors")
        .document(auth_collector)
    )
    lh = filtered_payload.get("local_health", {})
    metrics = filtered_payload.get("metrics", {})
    hb = filtered_payload.get("heartbeat", {})

    collector_update = {
        "source_id": filtered_payload.get("source_id"),
        "source_role": filtered_payload.get("source_role"),
        "customer_facing": filtered_payload.get("customer_facing"),
        "collector_version": filtered_payload.get("collector_version"),
        "config_version": filtered_payload.get("config_version"),
        "status": "online",
        "health_state": lh.get("state", "good"),
        "health_reasons": lh.get("reasons", []),
        "last_seen_utc": now_iso,
        "cpu_percent": metrics.get("cpu_percent"),
        "memory_percent": metrics.get("memory_percent"),
        "buffer_depth": hb.get("buffer_depth", 0),
        "source_timezone": filtered_payload.get("source_timezone"),
    }
    collector_ref.set(collector_update, merge=True)

    # 6. Store alerts if present
    alerts = filtered_payload.get("alerts", [])
    for alert in alerts:
        alert_id = f"alt_{payload_id[:8]}_{int(now_utc.timestamp())}"
        alert_data = {
            "source_id": filtered_payload.get("source_id"),
            "category": alert.get("category"),
            "severity": alert.get("severity"),
            "context": alert.get("context"),
            "event_time_utc": filtered_payload.get("event_time_utc"),
            "created_time_utc": now_iso,
            "incident_id": None,
        }
        db.collection(f"tenants/{auth_tenant}/alerts").document(alert_id).set(alert_data)

    return {"status": "accepted", "payload_id": payload_id}
