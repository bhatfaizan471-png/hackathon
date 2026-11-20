import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from backend.ingest import router as ingest_router
from backend.remediation import router as remediation_router
from backend.watchdog import watchdog_task
from backend.seed import seed_database
from backend.firestore_client import get_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure demo tenants and credentials exist on startup
    try:
        seed_database()
    except Exception:
        pass

    # Start background watchdog task
    task = asyncio.create_task(watchdog_task(interval_seconds=15))
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
    return {"status": "ok", "service": "nexus-observe-backend", "version": "1.0.0"}

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
