"""
collector.py — Main entry point for the NEXUS OBSERVE Local Collector.

Usage:
    python -m collector.collector [--simulate] [--interval N]
"""
from __future__ import annotations

import argparse
import signal
import sys
import time
import uuid
from datetime import datetime, timezone

from collector.config import BUFFER_DB_PATH, SEND_INTERVAL_SECONDS, load_thresholds
from collector.payload_builder import build_payload, mark_egress_sent
from collector.simulator import collect_all_raw
from collector.sqlite_buffer import SQLiteBuffer

_running = True


def _handle_signal(signum, frame):
    global _running
    print(f"\n[collector] received signal {signum}, shutting down…")
    _running = False


def main():
    parser = argparse.ArgumentParser(description="NEXUS OBSERVE Local Collector")
    parser.add_argument("--simulate", action="store_true", help="Use simulator instead of real metrics")
    parser.add_argument("--interval", type=int, default=None, help="Override send interval (seconds)")
    args = parser.parse_args()

    interval = args.interval if args.interval else SEND_INTERVAL_SECONDS

    signal.signal(signal.SIGINT, _handle_signal)
    try:
        signal.signal(signal.SIGTERM, _handle_signal)
    except (OSError, ValueError):
        pass  # SIGTERM not available on all platforms (e.g. Windows in some shells)

    buffer = SQLiteBuffer(BUFFER_DB_PATH)

    print(f"[collector] starting — interval={interval}s simulate={args.simulate}")

    while _running:
        if args.simulate:
            raw_payloads = collect_all_raw()
        else:
            # Real metrics (single host)
            from collector.metrics_collector import collect_metrics
            from collector.log_scanner import scan_failed_logins
            from collector.config import LOG_PATH, COLLECTOR_VERSION, CONFIG_VERSION

            metrics = collect_metrics()
            login_scan = scan_failed_logins(LOG_PATH)

            raw_payloads = [{
                "schema_version": "1.0",
                "payload_id": str(uuid.uuid4()),
                "tenant_id": "tenant_local",
                "collector_id": "col_local_01",
                "collector_version": COLLECTOR_VERSION,
                "source_id": "src_0000000001",
                "source_role": "employee_laptop",
                "seq": 1,
                "event_time_utc": datetime.now(timezone.utc).isoformat(),
                "sent_time_utc": datetime.now(timezone.utc).isoformat(),
                "source_timezone": "UTC",
                "config_version": CONFIG_VERSION,
                "heartbeat": {"uptime_s": 0, "buffer_depth": buffer.pending_count()},
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

        # Flush due items (placeholder — real send would go to Firebase here)
        for row in buffer.get_due():
            # In Stage 3 we just mark sent immediately (network layer is Stage 4)
            buffer.mark_sent(row["payload_id"])
            mark_egress_sent(row["payload_id"])
            print(f"[collector] sent {row['payload_id'][:8]}…")

        time.sleep(interval)

    print("[collector] stopped.")


if __name__ == "__main__":
    main()
