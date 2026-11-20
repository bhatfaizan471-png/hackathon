import asyncio
from datetime import datetime, timezone
from typing import Optional
from backend.config import WATCHDOG_OFFLINE_SECONDS
from backend.firestore_client import get_db

def check_and_update_silent_collectors(
    db=None,
    now_override: Optional[datetime] = None,
    offline_threshold_seconds: int = WATCHDOG_OFFLINE_SECONDS,
) -> int:
    """
    Scans all collectors across tenants.
    Reads tenant IDs dynamically from db.collection("tenants").stream().
    If now - last_seen_utc > offline_threshold_seconds and status is not 'offline':
      - updates collector status to 'offline', health_state to 'poor'
      - logs to health_history
    Returns count of updated collectors.
    """
    if db is None:
        db = get_db()

    now = now_override or datetime.now(timezone.utc)
    updated_count = 0

    tenants = [doc.id for doc in db.collection("tenants").stream()]
    for tenant_id in tenants:
        col_ref = db.collection(f"tenants/{tenant_id}/collectors")
        for doc in col_ref.stream():
            data = doc.to_dict()
            if data.get("status") != "offline":
                last_seen_str = data.get("last_seen_utc")
                if not last_seen_str:
                    continue
                try:
                    last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
                    diff_seconds = (now - last_seen).total_seconds()
                    if diff_seconds > offline_threshold_seconds:
                        # Mark collector poor and offline
                        doc_ref = col_ref.document(doc.id)
                        from_state = data.get("health_state", "unknown")
                        doc_ref.update({
                            "status": "offline",
                            "health_state": "poor",
                            "health_reasons": [
                                f"No heartbeat received for {int(diff_seconds)}s (exceeded {offline_threshold_seconds}s limit)"
                            ],
                        })
                        # Log health event
                        event_id = f"evt_{doc.id}_{int(now.timestamp())}"
                        event_data = {
                            "source_id": data.get("source_id", doc.id),
                            "from_state": from_state,
                            "to_state": "poor",
                            "reason": f"No heartbeat for {int(diff_seconds)}s",
                            "time_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        }
                        db.collection(f"tenants/{tenant_id}/health_history").document(event_id).set(event_data)
                        updated_count += 1
                except Exception:
                    pass

    return updated_count

async def watchdog_task(interval_seconds: int = 10):
    """Background loop that periodically executes watchdog check every 10 seconds."""
    while True:
        try:
            check_and_update_silent_collectors()
        except Exception:
            pass
        await asyncio.sleep(interval_seconds)
