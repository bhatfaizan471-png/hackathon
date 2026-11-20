from datetime import datetime, timezone
from typing import Tuple, List, Dict, Any, Optional

def evaluate_health_state(
    metrics: Dict[str, Any],
    security: Dict[str, Any],
    is_offline: bool = False,
) -> Tuple[str, List[str]]:
    """
    Evaluates product health state based on config/thresholds.json:
    - Excellent: fresh, within baseline
    - Good: minor deviation
    - Fair: elevated CPU (>75%), packet loss (>1%), or auth failures (>=5)
    - Poor: offline (>60s), CPU (>90%), packet loss (>5%), or auth failures (>=20)
    """
    reasons = []

    if is_offline:
        return "poor", ["Collector offline (no heartbeat for >60s)"]

    cpu = metrics.get("cpu_percent", 0.0)
    loss = metrics.get("packet_loss_percent", 0.0)
    auth_fails = security.get("auth_failure_count", 0)

    # Check Poor conditions
    if cpu >= 90.0:
        reasons.append(f"Critical CPU utilization ({cpu}% >= 90%)")
    if loss >= 5.0:
        reasons.append(f"Critical packet loss ({loss}% >= 5%)")
    if auth_fails >= 20:
        reasons.append(f"Critical auth failure spike ({auth_fails} in window)")

    if reasons:
        return "poor", reasons

    # Check Fair conditions
    if cpu >= 75.0:
        reasons.append(f"Elevated CPU utilization ({cpu}% >= 75%)")
    if loss >= 1.0:
        reasons.append(f"Elevated packet loss ({loss}% >= 1%)")
    if auth_fails >= 5:
        reasons.append(f"Elevated auth failure count ({auth_fails} in window)")

    if reasons:
        return "fair", reasons

    # Check Good conditions
    if cpu > 60.0 or loss > 0.0:
        return "good", ["Minor deviation from nominal baseline"]

    return "excellent", ["All telemetry metrics nominal"]

def record_state_transition(
    db,
    tenant_id: str,
    source_id: str,
    from_state: str,
    to_state: str,
    reason: str,
    time_utc: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Logs state transition to tenants/{tenant_id}/health_history."""
    if from_state == to_state:
        return None

    now_iso = time_utc or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    event_id = f"evt_{source_id}_{int(datetime.now(timezone.utc).timestamp())}"
    event_data = {
        "id": event_id,
        "source_id": source_id,
        "from_state": from_state,
        "to_state": to_state,
        "reason": reason,
        "time_utc": now_iso,
    }

    if db:
        db.collection(f"tenants/{tenant_id}/health_history").document(event_id).set(event_data)

    return event_data
