# Firebase Setup & Authentication Guide

## Project Configuration
- **Project ID**: `hackathon-5e1a9`
- **Authentication**: Firebase Auth (Email / Password)
- **Database**: Cloud Firestore

## Custom Tenant Claims
To enforce strict multi-tenant isolation, Nexus Observe maps authenticated users to tenants using Firebase Custom User Claims:
- `a@acme.test` -> `{"tenant_id": "tenant_acme_demo"}`
- `b@beta.test` -> `{"tenant_id": "tenant_beta_corp"}`

The claims can be set or updated by running:
```powershell
python -m backend.scripts.set_tenant_claims
```

> **Note**: Users must sign out and sign in again (or force a token refresh via `getIdTokenResult(true)`) after claims change for the new tenant claims to take effect.
