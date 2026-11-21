"""
backend/tests/test_claim.py — Unit tests for POST /v1/claim-tenant.
Tests valid code, wrong code, expired code, used-up code, already assigned tenant, and missing/invalid token.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
import pytest

from backend.main import app
from backend.firestore_client import MockFirestoreClient, set_db
import firebase_admin.auth as fb_auth

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_mock_firestore():
    mock_db = MockFirestoreClient()
    set_db(mock_db)
    yield mock_db


def test_missing_or_invalid_token(monkeypatch, setup_mock_firestore):
    # 1. No Authorization header
    resp = client.post("/v1/claim-tenant", json={"invite_code": "NXO-TEST-1234"})
    assert resp.status_code == 401
    assert "Missing or invalid" in resp.json()["detail"]

    # 2. Malformed Authorization header
    resp = client.post(
        "/v1/claim-tenant",
        json={"invite_code": "NXO-TEST-1234"},
        headers={"Authorization": "Token 12345"},
    )
    assert resp.status_code == 401

    # 3. Invalid token (verify_id_token raises exception)
    def mock_verify_fail(token):
        raise ValueError("Invalid Firebase token")

    monkeypatch.setattr(fb_auth, "verify_id_token", mock_verify_fail)
    resp = client.post(
        "/v1/claim-tenant",
        json={"invite_code": "NXO-TEST-1234"},
        headers={"Authorization": "Bearer bad-token"},
    )
    assert resp.status_code == 401
    assert "Invalid authentication token" in resp.json()["detail"]


def test_already_has_tenant_claim(monkeypatch, setup_mock_firestore):
    def mock_verify_with_tenant(token):
        return {"uid": "user_already_assigned", "tenant_id": "tenant_acme_demo"}

    monkeypatch.setattr(fb_auth, "verify_id_token", mock_verify_with_tenant)
    resp = client.post(
        "/v1/claim-tenant",
        json={"invite_code": "NXO-TEST-1234"},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "User already assigned to a tenant"


def test_wrong_code(monkeypatch, setup_mock_firestore):
    def mock_verify(token):
        return {"uid": "user_new"}

    monkeypatch.setattr(fb_auth, "verify_id_token", mock_verify)

    resp = client.post(
        "/v1/claim-tenant",
        json={"invite_code": "NXO-WRONG-CODE"},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Invalid or expired invite code"


def test_expired_code(monkeypatch, setup_mock_firestore):
    db = setup_mock_firestore
    plain_code = "NXO-EXPR-1234"
    code_hash = hashlib.sha256(plain_code.encode("utf-8")).hexdigest()

    expired_time = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    db.collection("tenant_invites").document(code_hash).set({
        "tenant_id": "tenant_acme_demo",
        "active": True,
        "max_uses": 25,
        "used_count": 0,
        "expires_at_utc": expired_time,
    })

    def mock_verify(token):
        return {"uid": "user_new"}

    monkeypatch.setattr(fb_auth, "verify_id_token", mock_verify)

    resp = client.post(
        "/v1/claim-tenant",
        json={"invite_code": plain_code},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Invalid or expired invite code"


def test_used_up_code(monkeypatch, setup_mock_firestore):
    db = setup_mock_firestore
    plain_code = "NXO-USED-1234"
    code_hash = hashlib.sha256(plain_code.encode("utf-8")).hexdigest()

    valid_until = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    db.collection("tenant_invites").document(code_hash).set({
        "tenant_id": "tenant_beta_corp",
        "active": True,
        "max_uses": 3,
        "used_count": 3,
        "expires_at_utc": valid_until,
    })

    def mock_verify(token):
        return {"uid": "user_new"}

    monkeypatch.setattr(fb_auth, "verify_id_token", mock_verify)

    resp = client.post(
        "/v1/claim-tenant",
        json={"invite_code": plain_code},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Invalid or expired invite code"


def test_valid_code_success(monkeypatch, setup_mock_firestore):
    db = setup_mock_firestore
    plain_code = "NXO-GOOD-9999"
    code_hash = hashlib.sha256(plain_code.encode("utf-8")).hexdigest()

    valid_until = (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    invite_ref = db.collection("tenant_invites").document(code_hash)
    invite_ref.set({
        "tenant_id": "tenant_beta_corp",
        "active": True,
        "max_uses": 5,
        "used_count": 1,
        "expires_at_utc": valid_until,
    })

    claimed_claims = {}

    def mock_verify(token):
        return {"uid": "user_valid_99"}

    def mock_set_claims(uid, claims):
        claimed_claims[uid] = claims

    monkeypatch.setattr(fb_auth, "verify_id_token", mock_verify)
    monkeypatch.setattr(fb_auth, "set_custom_user_claims", mock_set_claims)

    resp = client.post(
        "/v1/claim-tenant",
        json={"invite_code": "  nxo-good-9999  "},  # Test case-insensitivity and whitespace stripping
        headers={"Authorization": "Bearer valid-token"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"tenant_id": "tenant_beta_corp"}

    # Assert Firestore used_count incremented
    raw_snap = invite_ref.get()
    snap = next(iter(raw_snap), None) if not hasattr(raw_snap, "exists") else raw_snap
    assert snap.to_dict()["used_count"] == 2

    # Assert custom claim set
    assert claimed_claims.get("user_valid_99") == {"tenant_id": "tenant_beta_corp"}
