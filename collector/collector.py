"""
collector.py — Main entry point for the NEXUS OBSERVE Local Collector.

Usage:
    python -m collector.collector [--simulate] [--interval N] [--ingest-url URL]
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import signal
import sys
import threading
import time
import uuid
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

try:
    from backend.seed import DEMO_SECRETS
except ImportError:
    DEMO_SECRETS = {}

from collector.config import (
    BUFFER_DB_PATH,
    COLLECTOR_DIR,
    COLLECTOR_VERSION,
    CONFIG_VERSION,
    LOG_PATH,
    PROJECT_ROOT,
    SEND_INTERVAL_SECONDS,
    load_thresholds,
)
from collector.payload_builder import build_payload, mark_egress_sent
from collector.simulator import collect_all_raw
from collector.sqlite_buffer import SQLiteBuffer

# Ensure .env is loaded
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(COLLECTOR_DIR / ".env")
load_dotenv()

_running = True
_db_lock = threading.Lock()
_http_session: requests.Session | None = None


def _get_http_session() -> requests.Session:
    """Returns a shared HTTP session with connection pooling and keep-alive."""
    global _http_session
    if _http_session is None:
        _http_session = requests.Session()
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=10,
            pool_maxsize=10,
            max_retries=0,
        )
        _http_session.mount("http://", adapter)
        _http_session.mount("https://", adapter)
    return _http_session


def _handle_signal(signum, frame):
    global _running
    print(f"\n[collector] received signal {signum}, shutting down…")
    _running = False


def _send_collector_queue(
    cid: str,
    pending_rows: list,
    due_rows: list,
    buffer: SQLiteBuffer,
    ingest_url: str,
    simulate: bool,
    default_key: str,
    timeout: float,
    session: requests.Session,
) -> int:
    """
    Sends due items for a single collector in strict sequential FIFO order.
    Never reorders items belonging to the same collector.
    """
    if not due_rows or not pending_rows:
        return 0

    # Strict FIFO for this collector: oldest pending must be the first due item
    if due_rows[0]["payload_id"] != pending_rows[0]["payload_id"]:
        return 0

    sent_count = 0
    for row in due_rows:
        pid = row["payload_id"]
        json_bytes = row["json_text"].encode("utf-8")
        sha256 = row["sha256"]

        if not simulate and default_key:
            key = default_key
        elif simulate or cid in DEMO_SECRETS:
            key = DEMO_SECRETS.get(cid, default_key)
        else:
            key = default_key

        headers = {
            "Authorization": f"Bearer {key}",
            "X-Collector-Id": str(cid),
            "X-Payload-SHA256": str(sha256),
            "Content-Type": "application/json",
        }

        try:
            resp = session.post(ingest_url, data=json_bytes, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                with _db_lock:
                    buffer.mark_sent(pid)
                    mark_egress_sent(pid)
                sent_count += 1
                print(f"[collector] sent {pid[:8]}… ({cid}) HTTP 200")
            else:
                print(f"[collector] send failed for {pid[:8]}… ({cid}) HTTP {resp.status_code}: {resp.text}")
                with _db_lock:
                    buffer.mark_failed(pid, increment_attempts=True)
                break
        except Exception as e:
            print(f"[collector] network error sending {pid[:8]}… ({cid}): {e}")
            with _db_lock:
                buffer.mark_failed(pid, increment_attempts=True)
            break

    return sent_count


def send_due_items(
    buffer: SQLiteBuffer,
    ingest_url: str,
    simulate: bool = False,
    collector_id: str | None = None,
    collector_key: str | None = None,
    timeout: float = 10.0,
) -> int:
    """
    POST due items from the SQLite buffer to SAAS_INGEST_URL.
    - Groups items by collector_id.
    - Dispatches independent collectors concurrently (preventing sender bottlenecks).
    - Maintains strict FIFO ordering within each collector.
    - On HTTP 200 (accepted or duplicate): marks sent in buffer and egress log.
    - On network error or non-2xx: keeps pending and applies exponential backoff.
    """
    with _db_lock:
        all_rows = buffer.all_rows()
        due_rows = buffer.get_due()

    pending = [r for r in all_rows if r["status"] == "pending"]
    if not pending or not due_rows:
        return 0

    default_cid = collector_id or os.getenv("COLLECTOR_ID", "col_demo_laptop_01")
    default_key = collector_key if collector_key is not None else os.getenv("COLLECTOR_KEY", "")

    def _extract_cid(row) -> str:
        try:
            data = json.loads(row["json_text"])
            return data.get("collector_id", default_cid)
        except Exception:
            return default_cid

    # Group pending and due rows by collector_id
    pending_by_cid: dict[str, list] = {}
    for r in pending:
        cid = _extract_cid(r)
        pending_by_cid.setdefault(cid, []).append(r)

    due_by_cid: dict[str, list] = {}
    for r in due_rows:
        cid = _extract_cid(r)
        due_by_cid.setdefault(cid, []).append(r)

    session = _get_http_session()
    total_sent = 0

    # If only 1 collector, execute directly on current thread
    if len(due_by_cid) <= 1:
        for cid, c_due in due_by_cid.items():
            c_pending = pending_by_cid.get(cid, [])
            total_sent += _send_collector_queue(
                cid=cid,
                pending_rows=c_pending,
                due_rows=c_due,
                buffer=buffer,
                ingest_url=ingest_url,
                simulate=simulate,
                default_key=default_key,
                timeout=timeout,
                session=session,
            )
        return total_sent

    # Multiple distinct collectors: dispatch concurrently to eliminate sequential delay
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(due_by_cid), 5)) as executor:
        futures = {
            executor.submit(
                _send_collector_queue,
                cid,
                pending_by_cid.get(cid, []),
                c_due,
                buffer,
                ingest_url,
                simulate,
                default_key,
                timeout,
                session,
            ): cid
            for cid, c_due in due_by_cid.items()
        }
        for future in concurrent.futures.as_completed(futures):
            try:
                total_sent += future.result()
            except Exception as e:
                print(f"[collector] worker error: {e}")

    return total_sent


def main():
    parser = argparse.ArgumentParser(description="NEXUS OBSERVE Local Collector")
    parser.add_argument("--simulate", action="store_true", help="Use simulator instead of real metrics")
    parser.add_argument("--scenario", type=str, default=None, choices=["cpu_spike", "latency_rise", "service_failure", "failed_logins", "collector_outage"], help="Inject anomaly scenario")
    parser.add_argument("--interval", type=int, default=None, help="Override send interval (seconds)")
    parser.add_argument("--ingest-url", type=str, default=None, help="Override SaaS ingest URL")
    parser.add_argument("--once", action="store_true", help="Send a single batch and exit immediately")
    args = parser.parse_args()

    send_interval_env = os.getenv("SEND_INTERVAL_SECONDS")
    interval = args.interval if args.interval is not None else (int(send_interval_env) if send_interval_env else SEND_INTERVAL_SECONDS)
    ingest_url = args.ingest_url or os.getenv("SAAS_INGEST_URL", "http://localhost:8000/v1/ingest")

    signal.signal(signal.SIGINT, _handle_signal)
    try:
        signal.signal(signal.SIGTERM, _handle_signal)
    except (OSError, ValueError):
        pass  # SIGTERM not available on all platforms (e.g. Windows in some shells)

    buffer = SQLiteBuffer(BUFFER_DB_PATH)

    start_time = time.time()
    real_seq = 0
    print(f"[collector] starting — interval={interval}s simulate={args.simulate} url={ingest_url}")

    while _running:
        current_depth = buffer.pending_count()

        if args.simulate:
            raw_payloads = collect_all_raw(buffer_depth=current_depth, scenario=args.scenario)
        else:
            # Real metrics (single host)
            import socket
            import hashlib
            from collector.metrics_collector import collect_metrics
            from collector.log_scanner import scan_failed_logins

            tenant_id = os.getenv("TENANT_ID")
            collector_id = os.getenv("COLLECTOR_ID")
            collector_key = os.getenv("COLLECTOR_KEY")
            source_role = os.getenv("SOURCE_ROLE")

            if not tenant_id or not collector_id or not collector_key or not source_role:
                missing = [var for var, val in [("TENANT_ID", tenant_id), ("COLLECTOR_ID", collector_id), ("COLLECTOR_KEY", collector_key), ("SOURCE_ROLE", source_role)] if not val]
                print(f"[collector] ERROR: Missing required .env variable(s) for real mode: {', '.join(missing)}")
                return

            # Derive pseudonymous and stable source_id from salted SHA-256 of hostname
            hostname = socket.gethostname()
            salt = os.getenv("SOURCE_ID_SALT", "nexus_salt_v1")
            source_id = f"src_{hashlib.sha256(f'{salt}:{hostname}'.encode('utf-8')).hexdigest()[:10]}"

            real_seq += 1
            metrics = collect_metrics()
            login_scan = scan_failed_logins(LOG_PATH)
            uptime_s = int(time.time() - start_time)

            raw_payloads = [{
                "schema_version": "1.0",
                "payload_id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "collector_id": collector_id,
                "collector_version": COLLECTOR_VERSION,
                "source_id": source_id,
                "source_role": source_role,
                "seq": real_seq,
                "event_time_utc": datetime.now(timezone.utc).isoformat(),
                "sent_time_utc": datetime.now(timezone.utc).isoformat(),
                "source_timezone": "UTC",
                "config_version": CONFIG_VERSION,
                "heartbeat": {"uptime_s": uptime_s, "buffer_depth": current_depth},
                "metrics": {
                    **metrics,
                    "net_latency_ms": None,
                    "packet_loss_percent": 0.0,
                    "service_up": True,
                },
                "security": {
                    "auth_failure_count": login_scan["count"],
                    "window_s": login_scan["window_s"],
                    "risk_level": login_scan["risk_level"],
                },
                "local_health": {"state": "good", "reasons": []},
                "alerts": [],
            }]

        for raw in raw_payloads:
            payload_dict, json_bytes, sha256 = build_payload(raw)
            pid = payload_dict.get("payload_id", str(uuid.uuid4()))
            buffer.enqueue(pid, json_bytes.decode("utf-8"), sha256)

        # Flush due items over HTTP to SaaS ingest endpoint
        send_due_items(
            buffer=buffer,
            ingest_url=ingest_url,
            simulate=args.simulate,
            collector_id=collector_id if not args.simulate else None,
            collector_key=collector_key if not args.simulate else None,
        )

        if args.once:
            break

        time.sleep(interval)

    print("[collector] stopped.")


if __name__ == "__main__":
    main()
