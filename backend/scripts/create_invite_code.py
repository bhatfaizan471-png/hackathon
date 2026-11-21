"""
create_invite_code.py — Generates a secure tenant invite code.
Stores ONLY the SHA-256 hash in Firestore (tenant_invites/{hash}).
Prints the plain code ONCE to stdout and never writes it to disk.
"""
from __future__ import annotations

import argparse
import hashlib
import secrets
import string
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.firestore_client import get_db


def generate_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    safe_chars = [c for c in alphabet if c not in ("0", "O", "1", "I")]
    p1 = "".join(secrets.choice(safe_chars) for _ in range(4))
    p2 = "".join(secrets.choice(safe_chars) for _ in range(4))
    return f"NXO-{p1}-{p2}"


def create_invite(tenant_id: str, max_uses: int = 25, days_valid: int = 30) -> str:
    db = get_db()
    plain_code = generate_code()
    code_hash = hashlib.sha256(plain_code.encode("utf-8")).hexdigest()

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=days_valid)

    doc_data = {
        "tenant_id": tenant_id,
        "active": True,
        "max_uses": max_uses,
        "used_count": 0,
        "created_at_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expires_at_utc": expires.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    db.collection("tenant_invites").document(code_hash).set(doc_data)
    return plain_code


def main():
    parser = argparse.ArgumentParser(description="Create a secure tenant invite code")
    parser.add_argument("--tenant-id", required=True, help="Target tenant ID (e.g. tenant_acme_demo)")
    parser.add_argument("--max-uses", type=int, default=25, help="Maximum number of invite uses (default: 25)")
    parser.add_argument("--days-valid", type=int, default=30, help="Days until expiration (default: 30)")
    args = parser.parse_args()

    code = create_invite(tenant_id=args.tenant_id, max_uses=args.max_uses, days_valid=args.days_valid)

    print("\n" + "=" * 60)
    print("WARNING: This invite code is shown ONCE and cannot be recovered.")
    print("Never commit this code or store it in a public location.")
    print("=" * 60)
    print(f"Invite Code: {code}")
    print(f"Tenant ID:   {args.tenant_id}")
    print(f"Max Uses:    {args.max_uses}")
    print(f"Days Valid:  {args.days_valid}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
