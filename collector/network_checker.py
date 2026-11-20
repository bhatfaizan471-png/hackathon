"""
network_checker.py — Ping latency and packet-loss to configured targets.
Uses subprocess ping (cross-platform-ish; Windows & Linux differ slightly).
"""
from __future__ import annotations

import platform
import re
import subprocess
from typing import TypedDict


class NetworkResult(TypedDict):
    net_latency_ms: float | None
    packet_loss_percent: float


def check_network(target: str = "8.8.8.8", count: int = 4) -> NetworkResult:
    """
    Ping *target* *count* times and return latency + packet loss.
    Returns net_latency_ms=None if all packets lost.
    """
    system = platform.system().lower()
    if system == "windows":
        cmd = ["ping", "-n", str(count), target]
    else:
        cmd = ["ping", "-c", str(count), target]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=15,
        )
        output = result.stdout + result.stderr
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return NetworkResult(net_latency_ms=None, packet_loss_percent=100.0)

    # Parse packet loss
    loss_match = re.search(r'(\d+(?:\.\d+)?)%\s+(?:packet\s+)?loss', output, re.IGNORECASE)
    packet_loss = float(loss_match.group(1)) if loss_match else 100.0

    # Parse latency (Windows: Average = Xms ; Linux: rtt min/avg/max/mdev)
    latency: float | None = None
    win_match = re.search(r'Average\s*=\s*(\d+)ms', output, re.IGNORECASE)
    nix_match = re.search(r'rtt .* = [\d.]+/([\d.]+)/', output)
    if win_match:
        latency = float(win_match.group(1))
    elif nix_match:
        latency = float(nix_match.group(1))

    return NetworkResult(net_latency_ms=latency, packet_loss_percent=packet_loss)
