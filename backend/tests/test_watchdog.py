from datetime import datetime, timezone, timedelta
from backend.firestore_client import get_db
from backend.watchdog import check_and_update_silent_collectors

def test_7_watchdog_marks_silent_collector_poor_after_60s():
    db = get_db()

    # Step 1: Set up collector with last_seen_utc 65 seconds in the past
    base_time = datetime(2026, 11, 20, 14, 0, 0, tzinfo=timezone.utc)
    stale_time = (base_time - timedelta(seconds=65)).strftime("%Y-%m-%dT%H:%M:%SZ")

    col_ref = db.collection("tenants/tenant_acme_demo/collectors").document("col_sim_laptop_01")
    col_ref.set({
        "status": "online",
        "health_state": "excellent",
        "last_seen_utc": stale_time,
        "source_id": "src_1a2b3c4d5e",
    })

    # Step 2: Run watchdog with current simulated time = base_time
    updated = check_and_update_silent_collectors(
        db=db,
        now_override=base_time,
        offline_threshold_seconds=60,
    )

    assert updated >= 1, f"Expected at least 1 collector updated, got {updated}"

    # Step 3: Verify collector status updated to offline and health_state to poor
    updated_doc = col_ref.get().to_dict()
    assert updated_doc["status"] == "offline"
    assert updated_doc["health_state"] == "poor"
    assert "No heartbeat" in updated_doc["health_reasons"][0]

    # Step 4: Verify health history logged
    history_docs = db.collection("tenants/tenant_acme_demo/health_history").stream()
    assert len(history_docs) >= 1
    hist = history_docs[0].to_dict()
    assert hist["to_state"] == "poor"
    assert hist["from_state"] == "excellent"
