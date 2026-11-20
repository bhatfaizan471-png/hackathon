from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from backend.aiops.anomaly_detector import BaselineTracker
from backend.aiops.alert_manager import AlertManager
from backend.aiops.correlator import Correlator
from backend.aiops.health_engine import evaluate_health_state, record_state_transition, process_host_health

# Shared singleton instances across backend
baseline_tracker = BaselineTracker()
alert_manager = AlertManager(cooldown_seconds=120)
correlator = Correlator(window_seconds=120)

def process_telemetry(payload: Dict[str, Any], db=None) -> Dict[str, Any]:
    """
    Main AIOps processing pipeline invoked on ingest:
    1. Updates EWMA baseline.
    2. Identifies sustained spikes vs brief bumps.
    3. Triggers alerts (respecting cooldown).
    4. Correlates multi-signal alerts into Incidents with recommendations.
    5. Computes health transitions and records audit history.
    """
    tenant_id = payload["tenant_id"]
    source_id = payload["source_id"]
    metrics = payload.get("metrics", {})
    security = payload.get("security", {})
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    generated_alerts = []
    cpu = metrics.get("cpu_percent", 0.0)

    # 1. Anomaly detection via EWMA
    key = f"{tenant_id}::{source_id}::cpu"
    ewma, zscore, breaches = baseline_tracker.update(key, cpu)

    # Sustained CPU spike check (must exceed 75% or 90% and be sustained)
    if cpu >= 90.0:
        # Check if sustained
        if breaches >= 2 or cpu >= 95.0:  # 95%+ is critical sustained alert
            if alert_manager.should_emit_alert(tenant_id, source_id, "infra", now_utc):
                alert_id = f"alt_cpu_{source_id}_{int(now_utc.timestamp())}"
                alert_data = {
                    "id": alert_id,
                    "source_id": source_id,
                    "category": "infra",
                    "severity": "critical",
                    "context": f"Sustained CPU spike at {cpu}% (Z-score: {zscore:.1f}, EWMA: {ewma:.1f}%)",
                    "event_time_utc": payload.get("event_time_utc", now_iso),
                    "created_time_utc": now_iso,
                    "customer_facing": payload.get("customer_facing"),
                }
                generated_alerts.append(alert_data)
                if db:
                    db.collection(f"tenants/{tenant_id}/alerts").document(alert_id).set(alert_data)

    # 2. Network latency check
    latency = metrics.get("net_latency_ms", 0.0)
    if latency and latency > 100.0:
        if alert_manager.should_emit_alert(tenant_id, source_id, "network", now_utc):
            alert_id = f"alt_net_{source_id}_{int(now_utc.timestamp())}"
            alert_data = {
                "id": alert_id,
                "source_id": source_id,
                "category": "network",
                "severity": "high",
                "context": f"Elevated network latency at {latency}ms (>100ms baseline)",
                "event_time_utc": payload.get("event_time_utc", now_iso),
                "created_time_utc": now_iso,
                "customer_facing": payload.get("customer_facing"),
            }
            generated_alerts.append(alert_data)
            if db:
                db.collection(f"tenants/{tenant_id}/alerts").document(alert_id).set(alert_data)

    # 3. Security auth failure check
    fails = security.get("auth_failure_count", 0)
    if fails >= 5:
        if alert_manager.should_emit_alert(tenant_id, source_id, "security", now_utc):
            alert_id = f"alt_sec_{source_id}_{int(now_utc.timestamp())}"
            alert_data = {
                "id": alert_id,
                "source_id": source_id,
                "category": "security",
                "severity": "high" if fails < 20 else "critical",
                "context": f"{fails} failed logins in 60s (count only, no usernames/IPs)",
                "event_time_utc": payload.get("event_time_utc", now_iso),
                "created_time_utc": now_iso,
            }
            generated_alerts.append(alert_data)
            if db:
                db.collection(f"tenants/{tenant_id}/alerts").document(alert_id).set(alert_data)

    # 4. Correlation into Incidents
    created_incident = None
    for a in generated_alerts:
        inc = correlator.add_alert(tenant_id, a, now_utc)
        if inc:
            created_incident = inc
            if db:
                db.collection(f"tenants/{tenant_id}/incidents").document(inc["id"]).set(inc)

    # 5. Evaluate health state & state transitions with hysteresis & transaction
    collector_id = payload.get("collector_id", source_id)
    state, reasons = evaluate_health_state(metrics, security)
    transition = process_host_health(
        db=db,
        tenant_id=tenant_id,
        collector_id=collector_id,
        source_id=source_id,
        metrics=metrics,
        security=security,
        now_iso=now_iso,
    )

    return {
        "health_state": state,
        "health_reasons": reasons,
        "alerts_generated": generated_alerts,
        "incident": created_incident,
        "transition": transition,
    }
