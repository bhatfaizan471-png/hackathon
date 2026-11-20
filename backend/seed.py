import hashlib
from datetime import datetime, timezone
from backend.firestore_client import get_db

DEMO_SECRETS = {
    "col_sim_laptop_01": "demo-key-laptop-01",
    "col_sim_web_01": "demo-key-web-01",
    "col_sim_db_01": "demo-key-db-01",
}

def seed_database():
    """
    Seeds initial tenants and collector credentials.
    Also computes and displays estimated daily write count.
    """
    db = get_db()
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # 1. Tenants
    tenants = [
        {
            "id": "tenant_acme_demo",
            "name": "Company A (Acme Demo)",
            "region": "asia-south1 (simulated)",
            "created_at_utc": now_iso,
        },
        {
            "id": "tenant_beta_corp",
            "name": "Company B (Beta Corp)",
            "region": "asia-south1 (simulated)",
            "created_at_utc": now_iso,
        },
    ]

    for t in tenants:
        doc_id = t["id"]
        db.collection("tenants").document(doc_id).set(t)
        print(f"[Seed] Created tenant: {doc_id} -> {t['name']}")

    # 2. Collector credentials
    collectors = [
        {"id": "col_sim_laptop_01", "tenant_id": "tenant_acme_demo", "key": DEMO_SECRETS["col_sim_laptop_01"]},
        {"id": "col_sim_web_01", "tenant_id": "tenant_acme_demo", "key": DEMO_SECRETS["col_sim_web_01"]},
        {"id": "col_sim_db_01", "tenant_id": "tenant_beta_corp", "key": DEMO_SECRETS["col_sim_db_01"]},
    ]

    for c in collectors:
        key_hash = hashlib.sha256(c["key"].encode("utf-8")).hexdigest()
        db.collection("collector_credentials").document(c["id"]).set({
            "tenant_id": c["tenant_id"],
            "key_hash": key_hash,
            "created_at_utc": now_iso,
            "active": True,
        })
        print(f"[Seed] Created credential: {c['id']} (tenant: {c['tenant_id']}, key: {c['key']})")

    # 3. Report daily write count estimate
    # 3 collectors, 5s interval, 8 hours active demonstration
    # 3 * (3600 / 5) * 8 = 17,280 writes
    daily_telemetry = 3 * (3600 // 5) * 8
    daily_merges = 3 * (3600 // 5) * 8
    daily_alerts = 40
    print("\n--- Daily Write Count Estimate ---")
    print(f"Collectors: 3 | Send interval: 5s | Active hours: 8h")
    print(f"Telemetry writes (new docs): {daily_telemetry:,} / day")
    print(f"Collector status updates (merges): {daily_merges:,} / day")
    print(f"Estimated alert events: ~{daily_alerts} / day")
    print(f"Total write operations: ~{daily_telemetry + daily_merges + daily_alerts:,} / day")
    print("Recommendation: Set SEND_INTERVAL_SECONDS=10s for multi-day testing to stay well below 20k free tier limit.")

if __name__ == "__main__":
    seed_database()
