"""
health_engine.py — Health evaluation, hysteresis state machine, and atomic transition logging.
"""
from datetime import datetime, timezone
import json
import random
from typing import Tuple, List, Dict, Any, Optional
from backend.config import THRESHOLDS_PATH


def load_thresholds() -> dict:
    try:
        with open(THRESHOLDS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def evaluate_health_state(
    metrics: Dict[str, Any],
    security: Dict[str, Any],
    is_offline: bool = False,
    thresholds_config: Optional[Dict[str, Any]] = None,
) -> Tuple[str, List[str]]:
    """
    Evaluates product health state based on config/thresholds.json:
    - Excellent: fresh, within nominal baseline
    - Good: minor deviation
    - Fair: elevated CPU (>=75%), packet loss (>=1%), or auth failures (>=5)
    - Poor: offline (>60s), CPU (>=90%), packet loss (>=5%), or auth failures (>=20)
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


def check_recovery_margin(
    metrics: Dict[str, Any],
    security: Dict[str, Any],
    current_state: str,
    margin_multiplier: float = 0.8,
) -> bool:
    """
    Checks if telemetry is clearly below the threshold for the current state.
    For example:
    - If current_state is 'fair' (limit: packet loss 1.0%, cpu 75%),
      recovery requires loss <= 0.8% and cpu <= 60%.
    - If current_state is 'poor' (limit: packet loss 5.0%, cpu 90%),
      recovery requires loss <= 4.0% and cpu <= 72%.
    """
    cpu = metrics.get("cpu_percent", 0.0)
    loss = metrics.get("packet_loss_percent", 0.0)
    auth_fails = security.get("auth_failure_count", 0)

    if current_state == "fair":
        max_loss = 1.0 * margin_multiplier      # 0.8%
        max_cpu = 75.0 * margin_multiplier      # 60.0%
        max_auth = int(5 * margin_multiplier)   # 4
        if loss > max_loss or cpu > max_cpu or auth_fails > max_auth:
            return False
        return True

    elif current_state == "poor":
        max_loss = 5.0 * margin_multiplier      # 4.0%
        max_cpu = 90.0 * margin_multiplier      # 72.0%
        max_auth = int(20 * margin_multiplier)  # 16
        if loss > max_loss or cpu > max_cpu or auth_fails > max_auth:
            return False
        return True

    return True


def record_state_transition(
    db,
    tenant_id: str,
    source_id: str,
    from_state: str,
    to_state: str,
    reason: str,
    time_utc: Optional[str] = None,
    collector_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Logs state transition to tenants/{tenant_id}/health_history."""
    if from_state == to_state:
        return None

    now_iso = time_utc or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    event_id = f"evt_{source_id}_{ts}_{random.randint(100, 999)}"
    event_data = {
        "id": event_id,
        "source_id": source_id,
        "collector_id": collector_id or source_id,
        "from_state": from_state,
        "to_state": to_state,
        "reason": reason,
        "time_utc": now_iso,
    }

    if db:
        db.collection(f"tenants/{tenant_id}/health_history").document(event_id).set(event_data)

    return event_data


def process_host_health(
    db,
    tenant_id: str,
    collector_id: str,
    source_id: str,
    metrics: Dict[str, Any],
    security: Dict[str, Any],
    now_iso: str,
    is_offline: bool = False,
    thresholds_config: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Evaluates product health with hysteresis and updates collector state and
    health_history inside a Firestore transaction.
    """
    if db is None:
        return None

    from backend.firestore_client import run_transaction

    cfg = thresholds_config or load_thresholds()
    hyst = cfg.get("hysteresis", {})
    req_degrade = hyst.get("consecutive_breaches_to_degrade", 3)
    req_recover = hyst.get("consecutive_samples_to_recover", 3)
    margin_mult = hyst.get("recovery_margin_multiplier", 0.8)

    raw_state, reasons = evaluate_health_state(metrics, security, is_offline=is_offline, thresholds_config=cfg)
    ranks = {"excellent": 0, "good": 1, "fair": 2, "poor": 3}

    def _tx_callback(transaction):
        col_ref = db.collection(f"tenants/{tenant_id}/collectors").document(collector_id)
        raw_snap = transaction.get(col_ref)
        col_snap = next(iter(raw_snap), None) if (hasattr(raw_snap, "__iter__") and not hasattr(raw_snap, "exists")) else raw_snap

        is_new_host = col_snap is None or not col_snap.exists
        col_data = col_snap.to_dict() if (col_snap and col_snap.exists) else {}

        current_state = col_data.get("health_state", "unknown")
        pending_state = col_data.get("pending_state")
        consecutive_count = col_data.get("consecutive_count", 0)

        transition = None
        new_health_state = current_state
        new_pending_state = pending_state
        new_consecutive_count = consecutive_count
        new_reasons = reasons

        # Offline / missing heartbeat is exempt: immediately triggers poor
        if is_offline:
            if current_state != "poor":
                ts = int(datetime.now(timezone.utc).timestamp() * 1000)
                event_id = f"evt_{source_id}_{ts}_{random.randint(100, 999)}"
                transition = {
                    "id": event_id,
                    "source_id": source_id,
                    "collector_id": collector_id,
                    "from_state": current_state,
                    "to_state": "poor",
                    "reason": "; ".join(reasons) if reasons else "Collector offline",
                    "time_utc": now_iso,
                }
                hist_ref = db.collection(f"tenants/{tenant_id}/health_history").document(event_id)
                transaction.set(hist_ref, transition)
                new_health_state = "poor"
                new_pending_state = None
                new_consecutive_count = 0

            transaction.set(col_ref, {
                "health_state": new_health_state,
                "health_reasons": new_reasons,
                "pending_state": new_pending_state,
                "consecutive_count": new_consecutive_count,
                "status": "offline",
            }, merge=True)
            return transition

        if is_new_host or current_state == "unknown":
            # First state of a new host has from_state 'unknown'
            new_health_state = raw_state
            new_pending_state = None
            new_consecutive_count = 0
            ts = int(datetime.now(timezone.utc).timestamp() * 1000)
            event_id = f"evt_{source_id}_{ts}_{random.randint(100, 999)}"
            transition = {
                "id": event_id,
                "source_id": source_id,
                "collector_id": collector_id,
                "from_state": "unknown",
                "to_state": raw_state,
                "reason": "; ".join(reasons) if reasons else "Initial host discovery",
                "time_utc": now_iso,
            }
            hist_ref = db.collection(f"tenants/{tenant_id}/health_history").document(event_id)
            transaction.set(hist_ref, transition)
        else:
            r_curr = ranks.get(current_state, 1)
            r_raw = ranks.get(raw_state, 1)

            if r_raw == r_curr:
                # Same state as current confirmed state -> reset pending counters
                new_pending_state = None
                new_consecutive_count = 0
            elif r_raw > r_curr:
                # Degradation (worse state): enter worse state only after N consecutive breaches
                if pending_state == raw_state:
                    new_consecutive_count = consecutive_count + 1
                else:
                    new_pending_state = raw_state
                    new_consecutive_count = 1

                if new_consecutive_count >= req_degrade:
                    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
                    event_id = f"evt_{source_id}_{ts}_{random.randint(100, 999)}"
                    transition = {
                        "id": event_id,
                        "source_id": source_id,
                        "collector_id": collector_id,
                        "from_state": current_state,
                        "to_state": raw_state,
                        "reason": "; ".join(reasons) if reasons else f"Degraded to {raw_state}",
                        "time_utc": now_iso,
                    }
                    hist_ref = db.collection(f"tenants/{tenant_id}/health_history").document(event_id)
                    transaction.set(hist_ref, transition)
                    new_health_state = raw_state
                    new_pending_state = None
                    new_consecutive_count = 0
            else:
                # Recovery (better state): r_raw < r_curr
                # Check recovery margin: must be clearly below threshold
                if check_recovery_margin(metrics, security, current_state, margin_mult):
                    if pending_state == raw_state:
                        new_consecutive_count = consecutive_count + 1
                    else:
                        new_pending_state = raw_state
                        new_consecutive_count = 1

                    if new_consecutive_count >= req_recover:
                        ts = int(datetime.now(timezone.utc).timestamp() * 1000)
                        event_id = f"evt_{source_id}_{ts}_{random.randint(100, 999)}"
                        recovery_reason = f"Recovered to {raw_state} after {req_recover} consecutive clean samples"
                        transition = {
                            "id": event_id,
                            "source_id": source_id,
                            "collector_id": collector_id,
                            "from_state": current_state,
                            "to_state": raw_state,
                            "reason": recovery_reason,
                            "time_utc": now_iso,
                        }
                        hist_ref = db.collection(f"tenants/{tenant_id}/health_history").document(event_id)
                        transaction.set(hist_ref, transition)
                        new_health_state = raw_state
                        new_pending_state = None
                        new_consecutive_count = 0
                else:
                    new_pending_state = None
                    new_consecutive_count = 0

        transaction.set(col_ref, {
            "health_state": new_health_state,
            "health_reasons": new_reasons,
            "pending_state": new_pending_state,
            "consecutive_count": new_consecutive_count,
            "status": "online",
        }, merge=True)

        return transition

    return run_transaction(db, _tx_callback)
