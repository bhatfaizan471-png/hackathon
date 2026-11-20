import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.ingest import router as ingest_router
from backend.watchdog import watchdog_task

@asynccontextmanager
async def lifespan(app: FastAPI):
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

@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "nexus-observe-backend", "version": "1.0.0"}
