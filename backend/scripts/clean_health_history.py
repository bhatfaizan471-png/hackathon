"""
clean_health_history.py — Safely delete only the health_history documents
for demo tenants: tenant_acme_demo and tenant_beta_corp.
"""
from __future__ import annotations
from backend.firestore_client import get_db


def clean_health_history(dry_run: bool = False) -> dict[str, int]:
    db = get_db()
    tenants = ["tenant_acme_demo", "tenant_beta_corp"]
    counts: dict[str, int] = {}

    for tid in tenants:
        coll = db.collection(f"tenants/{tid}/health_history")
        docs = list(coll.stream())
        counts[tid] = len(docs)
        if not dry_run:
            for doc in docs:
                doc.reference.delete()

    return counts


if __name__ == "__main__":
    counts = clean_health_history(dry_run=False)
    for tid, count in counts.items():
        print(f"Deleted {count} health_history documents from {tid}")
