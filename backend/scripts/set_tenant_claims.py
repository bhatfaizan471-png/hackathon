"""
set_tenant_claims.py — Sets custom tenant_id claims on Firebase Auth users.

Users and claims:
  a@acme.test -> {"tenant_id": "tenant_acme_demo"}
  b@beta.test -> {"tenant_id": "tenant_beta_corp"}
"""
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import firebase_admin
from firebase_admin import auth
from backend.firestore_client import get_db

USER_CLAIMS = {
    "a@acme.test": {"tenant_id": "tenant_acme_demo"},
    "b@beta.test": {"tenant_id": "tenant_beta_corp"},
}

def set_claims():
    """Initializes Firebase Admin and assigns custom claims to designated users."""
    # Ensure Firebase Admin is initialized using existing credentials setup
    get_db()

    for email, claims in USER_CLAIMS.items():
        try:
            user = auth.get_user_by_email(email)
        except auth.UserNotFoundError:
            # Create user if not found in Firebase Auth
            user = auth.create_user(
                email=email,
                password="Password123!",
                email_verified=True,
            )
            print(f"Created user: {email}")

        auth.set_custom_user_claims(user.uid, claims)
        print(f"{email} -> {claims}")

if __name__ == "__main__":
    set_claims()
