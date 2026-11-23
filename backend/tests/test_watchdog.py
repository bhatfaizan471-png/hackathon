from datetime import datetime, timezone, timedelta
from backend.firestore_client import get_db
from backend.watchdog import check_and_update_silent_collectors
from backend.config import WATCHDOG_OFFLINE_SECONDS

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


def test_watchdog_marks_silent_collector_poor_after_45s():
    """
    TASK C test:
    Demonstrates that a collector with no heartbeat for > 45s (e.g. 46s)
    transitions to 'poor' and 'offline' using the 45s threshold.
    """
    db = get_db()

    base_time = datetime(2026, 11, 20, 15, 0, 0, tzinfo=timezone.utc)

    # 1. Collector seen 40s ago (within 45s threshold) -> should stay online
    fresh_time = (base_time - timedelta(seconds=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
    col_fresh = db.collection("tenants/tenant_acme_demo/collectors").document("col_fresh_01")
    col_fresh.set({
        "status": "online",
        "health_state": "good",
        "last_seen_utc": fresh_time,
        "source_id": "src_fresh",
    })

    # 2. Collector seen 46s ago (> 45s threshold) -> should transition to poor
    stale_time = (base_time - timedelta(seconds=46)).strftime("%Y-%m-%dT%H:%M:%SZ")
    col_stale = db.collection("tenants/tenant_acme_demo/collectors").document("col_stale_45s")
    col_stale.set({
        "status": "online",
        "health_state": "good",
        "last_seen_utc": stale_time,
        "source_id": "src_stale",
    })

    # Run watchdog using default threshold (or explicit 45s) and now_override
    updated = check_and_update_silent_collectors(
        db=db,
        now_override=base_time,
        offline_threshold_seconds=45,
    )

    assert updated >= 1

    # col_fresh should remain online
    fresh_doc = col_fresh.get().to_dict()
    assert fresh_doc["status"] == "online"
    assert fresh_doc["health_state"] == "good"

    # col_stale should be offline and poor
    stale_doc = col_stale.get().to_dict()
    assert stale_doc["status"] == "offline"
    assert stale_doc["health_state"] == "poor"
    assert "45s limit" in stale_doc["health_reasons"][0]


def test_watchdog_respects_observed_interval_threshold():
    """
    TASK B test:
    Per collector offline threshold = max(WATCHDOG_OFFLINE_SECONDS, 3 * observed_interval_s)
    when observed_interval_s exists, otherwise WATCHDOG_OFFLINE_SECONDS.
    A 30 s collector is not marked offline after 40 s, and is marked offline after 100 s.
    """
    db = get_db()
    base_time = datetime(2026, 11, 20, 16, 0, 0, tzinfo=timezone.utc)

    # 1. Set up a 30s collector seen 40s ago
    last_seen_40s = (base_time - timedelta(seconds=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
    col_ref = db.collection("tenants/tenant_acme_demo/collectors").document("col_30s_test")
    col_ref.set({
        "status": "online",
        "health_state": "good",
        "observed_interval_s": 30.0,
        "last_seen_utc": last_seen_40s,
        "source_id": "src_30s_test",
    })

    # Watchdog run at base_time: diff is 40s.
    # Offline threshold is max(45, 3 * 30) = 90s.
    # 40s <= 90s, so it must NOT be marked offline.
    check_and_update_silent_collectors(
        db=db,
        now_override=base_time,
    )
    doc_after_40s = col_ref.get().to_dict()
    assert doc_after_40s["status"] == "online"
    assert doc_after_40s["health_state"] == "good"

    # Watchdog run at base_time + 60s: diff is 40s + 60s = 100s.
    # 100s > 90s, so it MUST be marked offline and poor.
    later_time = base_time + timedelta(seconds=60)
    updated = check_and_update_silent_collectors(
        db=db,
        now_override=later_time,
    )
    assert updated >= 1
    doc_after_100s = col_ref.get().to_dict()
    assert doc_after_100s["status"] == "offline"
    assert doc_after_100s["health_state"] == "poor"
    assert "90s limit" in doc_after_100s["health_reasons"][0]

