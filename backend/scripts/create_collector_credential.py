"""
create_collector_credential.py — Generates a secure API key for a collector.
Stores ONLY the SHA-256 hash in Firestore (collector_credentials/{collector_id}).
Prints the plain key ONCE to stdout and never writes it to disk.
"""
from __future__ import annotations

import argparse
import hashlib
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.firestore_client import get_db


def create_credential(collector_id: str, tenant_id: str) -> str:
    db = get_db()
    plain_key = secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(plain_key.encode("utf-8")).hexdigest()

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    doc_data = {
        "tenant_id": tenant_id,
        "key_hash": key_hash,
        "active": True,
        "created_at_utc": now_iso,
    }

    db.collection("collector_credentials").document(collector_id).set(doc_data)
    return plain_key


def main():
    parser = argparse.ArgumentParser(description="Create a secure collector credential")
    parser.add_argument("--collector-id", required=True, help="Collector identifier (e.g. col_laptop_02)")
    parser.add_argument("--tenant-id", required=True, help="Tenant ID (e.g. tenant_acme_demo)")
    args = parser.parse_args()

    key = create_credential(collector_id=args.collector_id, tenant_id=args.tenant_id)

    print("\n" + "=" * 60)
    print("WARNING: This collector key is shown ONCE and cannot be recovered.")
    print("Never commit this key or share it publicly.")
    print("=" * 60)
    print(f"Collector ID: {args.collector_id}")
    print(f"Tenant ID:    {args.tenant_id}")
    print(f"API Key:      {key}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
