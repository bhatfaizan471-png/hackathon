"""
measure_buffer_depth.py — Measures collector buffer_depth in steady state over a timed run.

Usage:
    python -m collector.measure_buffer_depth [--duration SECONDS] [--interval SECONDS] [--ingest-url URL]
"""
import argparse
import os
import sys
import tempfile
import time
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from collector.collector import send_due_items
from collector.payload_builder import build_payload
from collector.simulator import collect_all_raw
from collector.sqlite_buffer import SQLiteBuffer

def run_measurement(duration_seconds: int = 300, interval_seconds: int = 5, ingest_url: str = "http://127.0.0.1:8000/v1/ingest"):
    print(f"\n=======================================================")
    print(f"  COLLECTOR BUFFER_DEPTH STEADY-STATE MEASUREMENT")
    print(f"  Target: {ingest_url}")
    print(f"  Duration: {duration_seconds}s ({duration_seconds // 60}m) | Interval: {interval_seconds}s")
    print(f"=======================================================\n")

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        db_path = Path(tmpdir) / "measure_buffer.sqlite"
        buffer = SQLiteBuffer(db_path)

        start_time = time.monotonic()
        tick = 0
        records = []

        while (time.monotonic() - start_time) < duration_seconds:
            tick += 1
            tick_start = time.monotonic()

            # 1. Collect and enqueue
            depth_before = buffer.pending_count()
            raw_payloads = collect_all_raw(buffer_depth=depth_before)
            for raw in raw_payloads:
                pdict, jbytes, sha = build_payload(raw)
                buffer.enqueue(pdict["payload_id"], jbytes.decode("utf-8"), sha)

            depth_enqueued = buffer.pending_count()

            # 2. Flush due items to SaaS ingest
            sent = send_due_items(
                buffer=buffer,
                ingest_url=ingest_url,
                simulate=True,
            )

            # 3. Steady-state buffer depth after flush
            steady_state_depth = buffer.pending_count()
            elapsed_total = int(time.monotonic() - start_time)

            records.append({
                "tick": tick,
                "elapsed_s": elapsed_total,
                "enqueued": len(raw_payloads),
                "sent": sent,
                "depth_before": depth_before,
                "depth_enqueued": depth_enqueued,
                "steady_state_depth": steady_state_depth,
            })

            print(
                f"[Tick {tick:02d} | {elapsed_total:03d}s] "
                f"Enqueued: {len(raw_payloads)} | Sent: {sent} | "
                f"Steady-State Buffer Depth: {steady_state_depth}"
            )

            # Wait for remainder of interval
            spent = time.monotonic() - tick_start
            sleep_time = max(0.0, interval_seconds - spent)
            time.sleep(sleep_time)

        # Compute summary
        depths = [r["steady_state_depth"] for r in records]
        min_depth = min(depths) if depths else 0
        max_depth = max(depths) if depths else 0
        avg_depth = sum(depths) / len(depths) if depths else 0.0

        print(f"\n=======================================================")
        print(f"  MEASUREMENT COMPLETED ({len(records)} ticks over {int(time.monotonic() - start_time)}s)")
        print(f"  Min Steady-State Depth: {min_depth}")
        print(f"  Max Steady-State Depth: {max_depth}")
        print(f"  Avg Steady-State Depth: {avg_depth:.2f}")
        print(f"  Steady State <= 1: {'YES (PASS)' if max_depth <= 1 else 'NO (FAIL)'}")
        print(f"=======================================================\n")

        return records

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Collector Buffer Depth Measurement")
    parser.add_argument("--duration", type=int, default=300, help="Run duration in seconds (default 300s = 5m)")
    parser.add_argument("--interval", type=int, default=5, help="Tick interval in seconds (default 5s)")
    parser.add_argument("--ingest-url", type=str, default="http://127.0.0.1:8000/v1/ingest", help="SaaS Ingest URL")
    args = parser.parse_args()

    run_measurement(
        duration_seconds=args.duration,
        interval_seconds=args.interval,
        ingest_url=args.ingest_url,
    )
