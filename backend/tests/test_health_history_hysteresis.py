"""
test_health_history_hysteresis.py — Unit tests for health history hysteresis,
accurate from_state tracking, and transactional state updates across both demo tenants:
- tenant_acme_demo (2 hosts: col_sim_laptop_01, col_sim_web_01)
- tenant_beta_corp (1 host: col_sim_db_01)
"""
from datetime import datetime, timezone, timedelta
import pytest
from backend.firestore_client import get_db, set_db, MockFirestoreClient
from backend.aiops.health_engine import process_host_health, load_thresholds

DEMO_HOSTS = [
    # tenant_acme_demo (two hosts)
    ("tenant_acme_demo", "col_sim_laptop_01", "src_a1b2c3d4e5"),
    ("tenant_acme_demo", "col_sim_web_01", "src_b2c3d4e5f6"),
    # tenant_beta_corp (one host)
    ("tenant_beta_corp", "col_sim_db_01", "src_c3d4e5f6a7"),
]


@pytest.fixture(autouse=True)
def reset_mock_db():
    mock_db = MockFirestoreClient()
    set_db(mock_db)
    yield
    mock_db.reset()


def make_metrics(cpu=30.0, loss=0.2, mem=45.0, fails=0):
    metrics = {
        "cpu_percent": cpu,
        "packet_loss_percent": loss,
        "memory_percent": mem,
        "disk_percent": 40.0,
        "net_latency_ms": 25.0,
        "bandwidth_in_kbps": 200.0,
        "bandwidth_out_kbps": 100.0,
        "service_up": True,
    }
    security = {
        "auth_failure_count": fails,
        "window_s": 60,
        "risk_level": "none",
    }
    return metrics, security


@pytest.mark.parametrize("tenant_id,collector_id,source_id", DEMO_HOSTS)
def test_e_first_state_of_new_host_has_from_state_unknown(tenant_id, collector_id, source_id):
    """6e. First state of a new host has from_state 'unknown'."""
    db = get_db()
    metrics, sec = make_metrics(cpu=30.0, loss=0.2)
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    transition = process_host_health(
        db=db,
        tenant_id=tenant_id,
        collector_id=collector_id,
        source_id=source_id,
        metrics=metrics,
        security=sec,
        now_iso=now_iso,
    )

    assert transition is not None
    assert transition["from_state"] == "unknown"
    assert transition["to_state"] in ("good", "excellent")

    # Verify in Firestore collection
    history = db.collection(f"tenants/{tenant_id}/health_history").stream()
    assert len(history) == 1
    stored = history[0].to_dict()
    assert stored["from_state"] == "unknown"
    assert stored["source_id"] == source_id


@pytest.mark.parametrize("tenant_id,collector_id,source_id", DEMO_HOSTS)
def test_a_excellent_to_poor_writes_exactly_one_entry(tenant_id, collector_id, source_id):
    """6a. excellent -> poor writes exactly one entry with from_state excellent."""
    db = get_db()
    # Establish confirmed excellent state
    col_ref = db.collection(f"tenants/{tenant_id}/collectors").document(collector_id)
    col_ref.set({
        "health_state": "excellent",
        "status": "online",
        "pending_state": None,
        "consecutive_count": 0,
        "source_id": source_id,
    })

    # 3 consecutive samples breaching poor (CPU 95% >= 90%)
    crit_metrics, crit_sec = make_metrics(cpu=95.0, loss=6.0)

    t1 = process_host_health(db, tenant_id, collector_id, source_id, crit_metrics, crit_sec, "2026-11-20T10:00:00Z")
    assert t1 is None  # breach 1/3

    t2 = process_host_health(db, tenant_id, collector_id, source_id, crit_metrics, crit_sec, "2026-11-20T10:00:05Z")
    assert t2 is None  # breach 2/3

    t3 = process_host_health(db, tenant_id, collector_id, source_id, crit_metrics, crit_sec, "2026-11-20T10:00:10Z")
    assert t3 is not None  # breach 3/3 -> confirmed transition
    assert t3["from_state"] == "excellent"
    assert t3["to_state"] == "poor"

    # Subsequent poor samples do NOT write additional transitions
    t4 = process_host_health(db, tenant_id, collector_id, source_id, crit_metrics, crit_sec, "2026-11-20T10:00:15Z")
    assert t4 is None

    history = list(db.collection(f"tenants/{tenant_id}/health_history").stream())
    assert len(history) == 1
    assert history[0].to_dict()["from_state"] == "excellent"
    assert history[0].to_dict()["to_state"] == "poor"


@pytest.mark.parametrize("tenant_id,collector_id,source_id", DEMO_HOSTS)
def test_b_poor_to_excellent_writes_exactly_one_entry(tenant_id, collector_id, source_id):
    """6b. poor -> excellent writes exactly one entry with from_state poor."""
    db = get_db()
    # Establish confirmed poor state
    col_ref = db.collection(f"tenants/{tenant_id}/collectors").document(collector_id)
    col_ref.set({
        "health_state": "poor",
        "status": "online",
        "pending_state": None,
        "consecutive_count": 0,
        "source_id": source_id,
    })

    # 3 consecutive samples within recovery margin and nominal (CPU 20%, loss 0.0%)
    rec_metrics, rec_sec = make_metrics(cpu=20.0, loss=0.0)

    t1 = process_host_health(db, tenant_id, collector_id, source_id, rec_metrics, rec_sec, "2026-11-20T10:00:00Z")
    assert t1 is None  # recovery 1/3

    t2 = process_host_health(db, tenant_id, collector_id, source_id, rec_metrics, rec_sec, "2026-11-20T10:00:05Z")
    assert t2 is None  # recovery 2/3

    t3 = process_host_health(db, tenant_id, collector_id, source_id, rec_metrics, rec_sec, "2026-11-20T10:00:10Z")
    assert t3 is not None  # recovery 3/3 -> confirmed transition
    assert t3["from_state"] == "poor"
    assert t3["to_state"] == "excellent"

    # Subsequent nominal samples do NOT write additional transitions
    t4 = process_host_health(db, tenant_id, collector_id, source_id, rec_metrics, rec_sec, "2026-11-20T10:00:15Z")
    assert t4 is None

    history = list(db.collection(f"tenants/{tenant_id}/health_history").stream())
    assert len(history) == 1
    assert history[0].to_dict()["from_state"] == "poor"
    assert history[0].to_dict()["to_state"] == "excellent"


@pytest.mark.parametrize("tenant_id,collector_id,source_id", DEMO_HOSTS)
def test_c_10_consecutive_fair_payloads_write_exactly_one_entry(tenant_id, collector_id, source_id):
    """6c. 10 consecutive payloads that evaluate to fair write exactly one entry."""
    db = get_db()
    # Establish confirmed good state
    col_ref = db.collection(f"tenants/{tenant_id}/collectors").document(collector_id)
    col_ref.set({
        "health_state": "good",
        "status": "online",
        "pending_state": None,
        "consecutive_count": 0,
        "source_id": source_id,
    })

    fair_metrics, fair_sec = make_metrics(cpu=40.0, loss=1.5)  # loss >= 1.0% is fair
    transitions = []

    for i in range(10):
        iso = f"2026-11-20T10:00:{i*5:02d}Z"
        t = process_host_health(db, tenant_id, collector_id, source_id, fair_metrics, fair_sec, iso)
        if t:
            transitions.append(t)

    assert len(transitions) == 1
    assert transitions[0]["from_state"] == "good"
    assert transitions[0]["to_state"] == "fair"

    history = list(db.collection(f"tenants/{tenant_id}/health_history").stream())
    assert len(history) == 1


@pytest.mark.parametrize("tenant_id,collector_id,source_id", DEMO_HOSTS)
def test_d_alternating_packet_loss_produces_at_most_one_transition(tenant_id, collector_id, source_id):
    """6d. Values alternating 0.9% and 1.1% packet loss produce at most one transition."""
    db = get_db()
    col_ref = db.collection(f"tenants/{tenant_id}/collectors").document(collector_id)
    col_ref.set({
        "health_state": "good",
        "status": "online",
        "pending_state": None,
        "consecutive_count": 0,
        "source_id": source_id,
    })

    transitions = []
    # 10 samples alternating 0.9% and 1.1%
    losses = [0.9, 1.1, 0.9, 1.1, 0.9, 1.1, 0.9, 1.1, 0.9, 1.1]

    for i, loss in enumerate(losses):
        iso = f"2026-11-20T10:00:{i*5:02d}Z"
        m, s = make_metrics(cpu=30.0, loss=loss)
        t = process_host_health(db, tenant_id, collector_id, source_id, m, s, iso)
        if t:
            transitions.append(t)

    # Because values alternate, neither breaches 3 consecutive samples
    assert len(transitions) <= 1
    assert len(transitions) == 0  # No transitions while oscillating


@pytest.mark.parametrize("tenant_id,collector_id,source_id", DEMO_HOSTS)
def test_f_entries_are_in_real_order(tenant_id, collector_id, source_id):
    """6f. Entries are recorded in the real chronological order."""
    db = get_db()
    col_ref = db.collection(f"tenants/{tenant_id}/collectors").document(collector_id)
    col_ref.set({
        "health_state": "excellent",
        "status": "online",
        "pending_state": None,
        "consecutive_count": 0,
        "source_id": source_id,
    })

    timestamps = [
        "2026-11-20T10:00:00Z",
        "2026-11-20T10:00:05Z",
        "2026-11-20T10:00:10Z",  # transitions to poor
        "2026-11-20T10:05:00Z",
        "2026-11-20T10:05:05Z",
        "2026-11-20T10:05:10Z",  # transitions to good
    ]

    # Degrade to poor (3 samples)
    crit_m, crit_s = make_metrics(cpu=95.0, loss=6.0)
    for ts in timestamps[:3]:
        process_host_health(db, tenant_id, collector_id, source_id, crit_m, crit_s, ts)

    # Recover to good (3 samples)
    good_m, good_s = make_metrics(cpu=30.0, loss=0.2)
    for ts in timestamps[3:]:
        process_host_health(db, tenant_id, collector_id, source_id, good_m, good_s, ts)

    history = list(db.collection(f"tenants/{tenant_id}/health_history").stream())
    assert len(history) == 2

    # Verify strictly increasing timestamps
    t_first = datetime.fromisoformat(history[0].to_dict()["time_utc"].replace("Z", "+00:00"))
    t_second = datetime.fromisoformat(history[1].to_dict()["time_utc"].replace("Z", "+00:00"))
    assert t_first < t_second
    assert history[0].to_dict()["to_state"] == "poor"
    assert history[1].to_dict()["to_state"] == "good"


def test_transaction_generator_handling():
    """Requirement 3: Verify that process_host_health handles transactions where get() returns a generator."""
    db = get_db()
    ref = db.collection("tenants/tenant_acme_demo/collectors").document("col_sim_laptop_01")
    tx = db.transaction()
    res = tx.get(ref)

    # Assert get() returns a generator / iterable (matching real Google Cloud Firestore SDK behavior)
    assert hasattr(res, "__next__") or hasattr(res, "__iter__")
    assert not hasattr(res, "exists"), "Raw transaction.get() must return a generator, not a single snapshot"

    m, s = make_metrics(cpu=30.0, loss=0.2)
    t = process_host_health(db, "tenant_acme_demo", "col_sim_laptop_01", "src_a1b2c3d4e5", m, s, "2026-11-20T12:00:00Z")
    assert t is not None
    assert t["from_state"] == "unknown"

