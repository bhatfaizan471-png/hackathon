"""
Single-command local runner for Nexus Observe.
Runs:
1. Seed database
2. Starts FastAPI SaaS backend on http://127.0.0.1:8000
3. Starts simulated collectors
"""
import subprocess
import sys
import time

def main():
    print("==================================================")
    print("   NEXUS OBSERVE — ONE-COMMAND LOCAL STACK RUNNER   ")
    print("==================================================")

    # 1. Seed database
    print("\n[Step 1/3] Seeding demo tenants & collector credentials...")
    subprocess.run([sys.executable, "-m", "backend.seed"], check=True)

    # 2. Start Backend
    print("\n[Step 2/3] Launching FastAPI SaaS Ingest Server on port 8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"]
    )
    time.sleep(2)

    # 3. Start Simulator
    print("\n[Step 3/3] Starting Simulated Collectors (3 hosts: laptop, web, db)...")
    collector_proc = subprocess.Popen(
        [sys.executable, "-m", "collector.collector", "--simulate", "--interval", "5"]
    )

    print("\n" + "="*50)
    print("Nexus Observe is fully running!")
    print("  Backend API: http://127.0.0.1:8000/health")
    print("  Ingest URL:  http://127.0.0.1:8000/v1/ingest")
    print("  Frontend UI: cd frontend && npm run dev (or run preview)")
    print("Press Ctrl+C to stop all services.")
    print("="*50 + "\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping Nexus Observe services...")
        backend_proc.terminate()
        collector_proc.terminate()
        print("Done.")

if __name__ == "__main__":
    main()
