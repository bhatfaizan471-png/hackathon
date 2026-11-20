"""
simulator.py — 3 fake collectors that emit schema-valid payloads with slow drift.

Collectors:
  col_sim_laptop_01  → employee_laptop,   source_id: src_a1b2c3d4e5, tenant: tenant_acme_demo
  col_sim_web_01     → web_server,        customer_facing: "login",   tenant: tenant_acme_demo
  col_sim_db_01      → database_server,                               tenant: tenant_beta_corp
"""
from __future__ import annotations

import random
import time
import uuid
from datetime import datetime, timezone
from typing import Any


# ── Drift helper ──────────────────────────────────────────────────────────────

class _DriftValue:
    """A float that walks randomly around a centre, clamped to [lo, hi]."""

    def __init__(self, centre: float, lo: float, hi: float, step: float = 0.5):
        self._v = centre
        self._lo = lo
        self._hi = hi
        self._step = step

    def next(self) -> float:
        self._v += random.uniform(-self._step, self._step)
        self._v = max(self._lo, min(self._hi, self._v))
        return round(self._v, 2)


# ── Base simulator ────────────────────────────────────────────────────────────

class FakeCollector:
    def __init__(
        self,
        collector_id: str,
        source_role: str,
        source_id: str,
        tenant_id: str,
        customer_facing: str | None = None,
    ):
        self.collector_id = collector_id
        self.source_role = source_role
        self.source_id = source_id
        self.tenant_id = tenant_id
        self.customer_facing = customer_facing
        self._start = time.monotonic()
        self._seq = 0

        # Per-collector drifting metrics
        self._cpu = _DriftValue(30, 0, 95, step=2)
        self._mem = _DriftValue(50, 10, 95, step=1)
        self._disk = _DriftValue(60, 10, 99, step=0.2)
        self._latency = _DriftValue(20, 1, 300, step=5)
        self._loss = _DriftValue(0.5, 0, 10, step=0.3)
        self._bw_in = _DriftValue(500, 50, 5000, step=50)
        self._bw_out = _DriftValue(200, 10, 3000, step=30)
        self._auth_failures = _DriftValue(1, 0, 15, step=0.5)

    def _risk_level(self, failures: int) -> str:
        if failures == 0:
            return "none"
        if failures < 5:
            return "low"
        if failures < 20:
            return "medium"
        if failures < 40:
            return "high"
        return "critical"

    def build_raw(self) -> dict[str, Any]:
        """Return raw (unfiltered) data for this tick."""
        self._seq += 1
        now_utc = datetime.now(timezone.utc).isoformat()
        uptime = int(time.monotonic() - self._start)
        cpu = self._cpu.next()
        mem = self._mem.next()
        disk = self._disk.next()
        latency = self._latency.next()
        loss = self._loss.next()
        bw_in = self._bw_in.next()
        bw_out = self._bw_out.next()
        failures = max(0, int(self._auth_failures.next()))

        raw: dict[str, Any] = {
            "schema_version": "1.0",
            "payload_id": str(uuid.uuid4()),
            "tenant_id": self.tenant_id,
            "collector_id": self.collector_id,
            "collector_version": "0.3.0",
            "source_id": self.source_id,
            "source_role": self.source_role,
            "seq": self._seq,
            "event_time_utc": now_utc,
            "sent_time_utc": now_utc,
            "source_timezone": "UTC",
            "config_version": "1.0",
            "heartbeat": {
                "uptime_s": uptime,
                "buffer_depth": random.randint(0, 5),
                "simulated": True,
            },
            "metrics": {
                "cpu_percent": cpu,
                "memory_percent": mem,
                "disk_percent": disk,
                "net_latency_ms": latency,
                "packet_loss_percent": loss,
                "bandwidth_in_kbps": bw_in,
                "bandwidth_out_kbps": bw_out,
                "service_up": random.random() > 0.05,
            },
            "security": {
                "auth_failure_count": failures,
                "window_s": 60,
                "risk_level": self._risk_level(failures),
            },
            "local_health": {
                "state": "good" if cpu < 75 and mem < 80 else "fair",
                "reasons": [],
            },
            "alerts": [],
        }

        if self.customer_facing is not None:
            raw["customer_facing"] = self.customer_facing

        return raw


# ── The three named simulators ────────────────────────────────────────────────

SIMULATORS: list[FakeCollector] = [
    FakeCollector(
        collector_id="col_sim_laptop_01",
        source_role="employee_laptop",
        source_id="src_a1b2c3d4e5",
        tenant_id="tenant_acme_demo",
    ),
    FakeCollector(
        collector_id="col_sim_web_01",
        source_role="web_server",
        source_id="src_b2c3d4e5f6",
        tenant_id="tenant_acme_demo",
        customer_facing="login",
    ),
    FakeCollector(
        collector_id="col_sim_db_01",
        source_role="database_server",
        source_id="src_c3d4e5f6a7",
        tenant_id="tenant_beta_corp",
    ),
]


def collect_all_raw() -> list[dict[str, Any]]:
    """Return one raw payload dict per simulator."""
    return [sim.build_raw() for sim in SIMULATORS]
