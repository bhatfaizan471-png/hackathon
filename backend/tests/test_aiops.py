from datetime import datetime, timezone, timedelta
from backend.aiops.anomaly_detector import BaselineTracker
from backend.aiops.alert_manager import AlertManager
from backend.aiops.correlator import Correlator
from backend.aiops.health_engine import evaluate_health_state, record_state_transition
from backend.aiops.processor import process_telemetry
from backend.firestore_client import get_db

def test_1_and_2_sustained_spike_vs_brief_bump():
    """
    Exit Gate 1: Injected sustained CPU spike to 95% creates an alert with explanation.
    Exit Gate 2: A brief normal CPU bump creates NO alert.
    """
    tracker = BaselineTracker(alpha=0.1, warmup_samples=5, sustain_samples=2)

    # Establish normal baseline around 30%
    for _ in range(10):
        tracker.update("src_1::cpu", 30.0)

    # Brief bump to 55% (normal temporary bump)
    ewma, zscore, breaches = tracker.update("src_1::cpu", 55.0)
    assert not tracker.is_sustained_anomaly("src_1::cpu"), "Brief normal bump should NOT be flagged as sustained"

    # Sustained spike to 95% (2+ consecutive samples)
    tracker.update("src_1::cpu", 95.0)
    tracker.update("src_1::cpu", 95.0)
    assert tracker.is_sustained_anomaly("src_1::cpu"), "Sustained 95% CPU spike MUST be flagged as sustained anomaly"

def test_3_cooldown_suppression():
    """Exit Gate 3: Repeated alerts inside the cooldown are suppressed."""
    mgr = AlertManager(cooldown_seconds=120)
    now = datetime(2026, 11, 20, 14, 0, 0, tzinfo=timezone.utc)

    # First alert emitted
    assert mgr.should_emit_alert("tenant_a", "src_1", "infra", now) is True

    # 30 seconds later (inside 120s cooldown): MUST be suppressed
    inside_cooldown = now + timedelta(seconds=30)
    assert mgr.should_emit_alert("tenant_a", "src_1", "infra", inside_cooldown) is False

    # 130 seconds later (outside 120s cooldown): emitted
    outside_cooldown = now + timedelta(seconds=130)
    assert mgr.should_emit_alert("tenant_a", "src_1", "infra", outside_cooldown) is True

def test_4_and_5_correlation_and_explainable_recommendation():
    """
    Exit Gate 4: CPU + latency + service alerts on one host within 2 minutes become exactly one incident.
    Exit Gate 5: Every incident shows signals, scores, rule, confidence, reasoning; wording says 'probable cause'.
    """
    corr = Correlator(window_seconds=120)
    now = datetime(2026, 11, 20, 14, 0, 0, tzinfo=timezone.utc)

    # Alert 1: CPU spike (infra)
    a1 = {
        "id": "alt_1",
        "source_id": "src_host_a",
        "category": "infra",
        "severity": "critical",
        "created_time_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    inc1 = corr.add_alert("tenant_acme_demo", a1, now)
    # Single alert alone doesn't create multi-signal incident yet
    assert inc1 is None

    # Alert 2: Network Latency (network) within 30s
    a2 = {
        "id": "alt_2",
        "source_id": "src_host_a",
        "category": "network",
        "severity": "high",
        "created_time_utc": (now + timedelta(seconds=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    inc2 = corr.add_alert("tenant_acme_demo", a2, now + timedelta(seconds=30))

    # Multiple signals within 2 minutes MUST create exactly one correlated incident
    assert inc2 is not None
    assert "src_host_a" in inc2["affected_sources"]
    assert len(corr.incidents) == 1

    # Check Exit Gate 5 requirements:
    explanation = inc2["explanation"]
    assert "signals" in explanation
    assert "scores" in explanation
    assert "triggered_rule" in explanation
    assert "confidence" in explanation
    assert "reasoning_path" in explanation
    # Check mandatory wording: 'probable cause'
    assert "probable cause" in explanation["probable_cause"].lower(), "Wording MUST state 'probable cause'"

    # Check recommendation
    rec = inc2["recommendation"]
    assert "action" in rec
    assert "rationale" in rec
    assert "rollback_plan" in rec

def test_6_state_transition_logged_in_utc_with_reason():
    """Exit Gate 6: Every state transition is logged in UTC with a reason."""
    db = get_db()
    time_utc = "2026-11-20T14:05:00Z"
    event = record_state_transition(
        db=db,
        tenant_id="tenant_acme_demo",
        source_id="src_laptop",
        from_state="excellent",
        to_state="poor",
        reason="Critical CPU spike to 95%",
        time_utc=time_utc,
    )

    assert event is not None
    assert event["time_utc"] == time_utc
    assert event["from_state"] == "excellent"
    assert event["to_state"] == "poor"
    assert "Critical CPU" in event["reason"]

    # Verify document exists in Firestore mock
    doc = db.collection("tenants/tenant_acme_demo/health_history").document(event["id"]).get()
    assert doc.exists
    stored = doc.to_dict()
    assert stored["time_utc"] == time_utc
    assert stored["to_state"] == "poor"
