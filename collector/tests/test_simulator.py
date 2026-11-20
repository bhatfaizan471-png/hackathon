"""
test_simulator.py — Test 6: simulator produces labelled, schema-valid payloads for 3 collectors.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from collector.simulator import SIMULATORS, collect_all_raw
from collector.payload_builder import build_payload

REQUIRED_FIELDS = {
    "schema_version", "payload_id", "tenant_id", "collector_id",
    "heartbeat", "metrics", "security",
}

VALID_SOURCE_ROLES = {
    "employee_laptop", "web_server", "database_server",
    "app_server", "network_device",
}

EXPECTED_COLLECTORS = {
    "col_sim_laptop_01": {
        "source_role": "employee_laptop",
        "source_id": "src_a1b2c3d4e5",
        "tenant_id": "tenant_acme_demo",
    },
    "col_sim_web_01": {
        "source_role": "web_server",
        "tenant_id": "tenant_acme_demo",
    },
    "col_sim_db_01": {
        "source_role": "database_server",
        "tenant_id": "tenant_beta_corp",
    },
}


def test_simulator_produces_three_collectors():
    """There must be exactly 3 simulators."""
    assert len(SIMULATORS) == 3, f"Expected 3 simulators, got {len(SIMULATORS)}"
    collector_ids = {s.collector_id for s in SIMULATORS}
    assert collector_ids == set(EXPECTED_COLLECTORS.keys()), (
        f"Collector IDs mismatch: {collector_ids}"
    )


def test_simulator_payloads_are_schema_valid():
    """
    Each simulator must produce a payload that:
    - passes build_payload (allow-list filter)
    - contains all required top-level fields
    - has correct source_role and tenant_id
    - has simulated=True in heartbeat
    """
    raw_list = collect_all_raw()
    assert len(raw_list) == 3, f"collect_all_raw returned {len(raw_list)} items"

    for raw in raw_list:
        cid = raw.get("collector_id", "")
        assert cid in EXPECTED_COLLECTORS, f"Unknown collector_id: {cid}"

        # Build through the chokepoint
        payload_dict, json_bytes, sha256 = build_payload(raw)

        # Required top-level fields must be present
        for field in REQUIRED_FIELDS:
            assert field in payload_dict, (
                f"[{cid}] Required field '{field}' missing from payload"
            )

        # Source role must be valid
        assert payload_dict.get("source_role") in VALID_SOURCE_ROLES, (
            f"[{cid}] Invalid source_role: {payload_dict.get('source_role')}"
        )

        # Correct tenant
        expected_tenant = EXPECTED_COLLECTORS[cid]["tenant_id"]
        assert payload_dict.get("tenant_id") == expected_tenant, (
            f"[{cid}] tenant_id mismatch: {payload_dict.get('tenant_id')} != {expected_tenant}"
        )

        # simulated=True must be in heartbeat
        heartbeat = payload_dict.get("heartbeat", {})
        assert isinstance(heartbeat, dict), f"[{cid}] heartbeat is not a dict"
        assert heartbeat.get("simulated") is True, (
            f"[{cid}] heartbeat.simulated is not True: {heartbeat}"
        )

        # SHA-256 must be non-empty
        assert sha256 and len(sha256) == 64, f"[{cid}] Invalid sha256: {sha256}"


def test_simulator_metrics_in_valid_range():
    """Simulated metrics must stay within physical bounds."""
    raw_list = collect_all_raw()
    for raw in raw_list:
        payload_dict, _, _ = build_payload(raw)
        m = payload_dict.get("metrics", {})
        cid = raw.get("collector_id", "?")

        assert 0 <= m.get("cpu_percent", -1) <= 100, f"[{cid}] cpu_percent out of range"
        assert 0 <= m.get("memory_percent", -1) <= 100, f"[{cid}] memory_percent out of range"
        assert 0 <= m.get("disk_percent", -1) <= 100, f"[{cid}] disk_percent out of range"
        assert 0 <= m.get("packet_loss_percent", -1) <= 100, f"[{cid}] packet_loss_percent out of range"
        assert m.get("bandwidth_in_kbps", -1) >= 0, f"[{cid}] bandwidth_in_kbps negative"
        assert m.get("bandwidth_out_kbps", -1) >= 0, f"[{cid}] bandwidth_out_kbps negative"
