import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from backend.ingest import router as ingest_router
from backend.remediation import router as remediation_router
from backend.watchdog import watchdog_task
from backend.seed import seed_database
from backend.firestore_client import get_db, MockFirestoreClient

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verify Firestore connectivity at startup (refuses to start if unreachable)
    db = get_db()
    try:
        list(db.collection("tenants").limit(1).stream())
    except Exception as e:
        raise RuntimeError(f"Startup verification failed: Firestore is unreachable: {e}") from e

    # Ensure demo tenants and credentials exist on startup
    try:
        seed_database()
    except Exception:
        pass

    # Start background watchdog task (poll every 10 seconds per TASK C)
    task = asyncio.create_task(watchdog_task(interval_seconds=10))
    yield
    # Cleanup task on shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Nexus Observe SaaS Backend",
    version="1.0.0",
    description="Privacy-first, AIOps-driven multi-tenant SaaS ingest and observability backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(remediation_router)

@app.get("/health")
def healthcheck():
    db = get_db()
    is_mock = (
        os.getenv("USE_MOCK_FIRESTORE", "false").lower() == "true"
        or isinstance(db, MockFirestoreClient)
    )
    return {
        "status": "ok",
        "service": "nexus-observe-backend",
        "version": "1.0.0",
        "firestore": "mock" if is_mock else "ok",
    }

@app.get("/v1/data-summary")
def get_data_summary(tenant_id: str = Query("tenant_acme_demo")):
    """Summary of data stored for a given tenant."""
    db = get_db()
    telemetry_docs = list(db.collection(f"tenants/{tenant_id}/telemetry").stream())
    collector_docs = list(db.collection(f"tenants/{tenant_id}/collectors").stream())
    alert_docs = list(db.collection(f"tenants/{tenant_id}/alerts").stream())
    incident_docs = list(db.collection(f"tenants/{tenant_id}/incidents").stream())

    last_point = None
    if telemetry_docs:
        last_point = telemetry_docs[-1].to_dict()

    return {
        "tenant_id": tenant_id,
        "counts": {
            "telemetry": len(telemetry_docs),
            "collectors": len(collector_docs),
            "alerts": len(alert_docs),
            "incidents": len(incident_docs),
        },
        "latest_telemetry": last_point,
    }
