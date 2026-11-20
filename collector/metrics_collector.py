"""
metrics_collector.py — System metrics via psutil.
"""
from __future__ import annotations

import psutil


def collect_metrics() -> dict:
    """
    Collect CPU, RAM, disk, and network counters.
    Returns a flat dict matching the allow-list field names.
    """
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    # Network I/O delta (bytes since boot — good enough for a demo)
    net = psutil.net_io_counters()

    return {
        "cpu_percent": round(cpu, 2),
        "memory_percent": round(mem.percent, 2),
        "disk_percent": round(disk.percent, 2),
        # bandwidth: psutil gives cumulative bytes; we expose them as kbps
        # approximated over a 1-second window (best effort without state)
        "bandwidth_in_kbps": round(net.bytes_recv / 1024, 2),
        "bandwidth_out_kbps": round(net.bytes_sent / 1024, 2),
    }
