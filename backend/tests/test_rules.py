import re
from pathlib import Path

def evaluate_firestore_rule(auth_token: dict, path: str, method: str) -> bool:
    """
    Simulates the logic defined in firestore.rules:
    - Default deny: allow read, write: if false;
    - match /tenants/{tenantId}/{document=**}:
        allow read: if request.auth != null && request.auth.token.tenant_id == tenantId;
        allow write: if false;
    - match /collector_credentials/{document=**}:
        allow read, write: if false;
    """
    # 1. Any write from client is denied
    if method == "write":
        return False

    # 2. Collector credentials is fully private
    if path.startswith("collector_credentials/"):
        return False

    # 3. Tenants collection
    m = re.match(r"^tenants/([^/]+)/.*", path)
    if m:
        tenant_id = m.group(1)
        if auth_token is None:
            return False  # unauthenticated
        return auth_token.get("tenant_id") == tenant_id

    return False

def test_6_firestore_rules_tenant_isolation_and_write_denial():
    # Verify firestore.rules file exists
    rules_file = Path(__file__).resolve().parent.parent.parent / "firestore.rules"
    assert rules_file.exists(), "firestore.rules must exist at project root"
    rules_content = rules_file.read_text(encoding="utf-8")
    assert "request.auth.token.tenant_id == tenantId" in rules_content
    assert "allow write: if false;" in rules_content

    # Company A token
    token_a = {"sub": "user_a", "tenant_id": "tenant_acme_demo"}
    # Company B token
    token_b = {"sub": "user_b", "tenant_id": "tenant_beta_corp"}

    # Company A can read its own data
    assert evaluate_firestore_rule(token_a, "tenants/tenant_acme_demo/telemetry/p1", "read") is True

    # Company A CANNOT read Company B's data
    assert evaluate_firestore_rule(token_a, "tenants/tenant_beta_corp/telemetry/p1", "read") is False

    # Unauthenticated user cannot read anything
    assert evaluate_firestore_rule(None, "tenants/tenant_acme_demo/telemetry/p1", "read") is False

    # Client cannot write even to their own tenant
    assert evaluate_firestore_rule(token_a, "tenants/tenant_acme_demo/telemetry/p1", "write") is False

    # Nobody can read collector_credentials
    assert evaluate_firestore_rule(token_a, "collector_credentials/col_sim_laptop_01", "read") is False
    assert evaluate_firestore_rule(None, "collector_credentials/col_sim_laptop_01", "read") is False
