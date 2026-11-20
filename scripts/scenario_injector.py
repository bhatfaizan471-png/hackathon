"""
Scenario Injector for Nexus Observe.
Allows triggering simulated operational anomalies:
- cpu_spike
- latency_rise
- service_failure
- failed_logins
- collector_outage
"""
import sys
import argparse
from typing import Dict, Any

def inject_scenario(payload: Dict[str, Any], scenario: str) -> Dict[str, Any]:
    p = dict(payload)
    if "metrics" not in p:
        p["metrics"] = {}
    if "security" not in p:
        p["security"] = {}

    if scenario == "cpu_spike":
        p["metrics"]["cpu_percent"] = 96.5
    elif scenario == "latency_rise":
        p["metrics"]["net_latency_ms"] = 185.0
        p["metrics"]["packet_loss_percent"] = 2.5
    elif scenario == "service_failure":
        p["metrics"]["service_up"] = False
        p["metrics"]["net_latency_ms"] = 850.0
    elif scenario == "failed_logins":
        p["security"]["auth_failure_count"] = 18
        p["security"]["risk_level"] = "high"
    elif scenario == "collector_outage":
        p["heartbeat"]["uptime_s"] = 0
    return p

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Nexus Observe Scenario Injector")
    parser.add_argument("scenario", choices=["cpu_spike", "latency_rise", "service_failure", "failed_logins", "collector_outage"])
    args = parser.parse_args()
    print(f"[Injector] Scenario '{args.scenario}' configured.")
