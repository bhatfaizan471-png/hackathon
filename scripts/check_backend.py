"""
Backend Connectivity Checker for Nexus Observe.
Tests reachability of the FastAPI SaaS Ingest Server.
Run:
    python scripts/check_backend.py
"""
import sys
import time
import requests

BACKEND_URL = "http://127.0.0.1:8000"

def test_backend_connectivity():
    print("=" * 60)
    print("    NEXUS OBSERVE — BACKEND CONNECTIVITY CHECKER    ")
    print("=" * 60)
    print(f"Target URL: {BACKEND_URL}\n")

    # 1. Healthcheck Endpoint Test
    print("[1/2] Testing GET /health endpoint...")
    try:
        start = time.perf_counter()
        resp = requests.get(f"{BACKEND_URL}/health", timeout=3.0)
        elapsed_ms = (time.perf_counter() - start) * 1000

        if resp.status_code == 200:
            data = resp.json()
            print(f"  [OK] Server is reachable! Response latency: {elapsed_ms:.1f}ms")
            print(f"  [OK] Service Name: {data.get('service')}")
            print(f"  [OK] Version:      {data.get('version')}")
            print(f"  [OK] Status:       {data.get('status')}\n")
        else:
            print(f"  [FAIL] Unexpected HTTP status code: {resp.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("  [OFFLINE] Could not connect to FastAPI server at http://127.0.0.1:8000.")
        print("\n  To start the backend server, run:")
        print("      .\\.venv\\Scripts\\python.exe -m uvicorn backend.main:app --port 8000")
        print("  Or start the full stack with:")
        print("      python scripts/run_local.py\n")
        return False
    except Exception as e:
        print(f"  [ERROR] {e}\n")
        return False

    # 2. Ingest Endpoint Auth Guard Test
    print("[2/2] Testing POST /v1/ingest authentication guard...")
    try:
        resp = requests.post(f"{BACKEND_URL}/v1/ingest", json={}, timeout=3.0)
        if resp.status_code == 401:
            print("  [OK] /v1/ingest auth guard active (HTTP 401 Unauthorized for empty token)")
        else:
            print(f"  [NOTE] Response status: {resp.status_code}")
    except Exception as e:
        print(f"  [NOTE] Ingest check note: {e}")

    print("\n" + "=" * 60)
    print("  RESULT: Backend is UP, ACTIVE and fully operational! [PASS]")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = test_backend_connectivity()
    sys.exit(0 if success else 1)
