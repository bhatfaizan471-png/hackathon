"""
test_firestore_client.py — Tests for TASK A:
- get_db() returns mock client when USE_MOCK_FIRESTORE=true.
- get_db() raises RuntimeError with a clear message when USE_MOCK_FIRESTORE=false and credentials file is missing.
- /health reports 'firestore': 'mock' when mock is active.
"""
import os
import pytest
from fastapi.testclient import TestClient

from backend.firestore_client import get_db, MockFirestoreClient, set_db
from backend.main import app


def test_get_db_returns_mock_when_use_mock_firestore_true(monkeypatch):
    monkeypatch.setenv("USE_MOCK_FIRESTORE", "true")
    set_db(None)
    db = get_db()
    assert isinstance(db, MockFirestoreClient)


def test_get_db_raises_runtime_error_when_credentials_missing(monkeypatch):
    monkeypatch.setenv("USE_MOCK_FIRESTORE", "false")
    monkeypatch.setattr("backend.firestore_client.GOOGLE_APPLICATION_CREDENTIALS", "./non_existent_creds_xyz.json")
    monkeypatch.delenv("FIRESTORE_EMULATOR_HOST", raising=False)
    set_db(None)

    with pytest.raises(RuntimeError) as exc_info:
        get_db()

    assert "Firestore credentials file not found" in str(exc_info.value)
    assert "USE_MOCK_FIRESTORE=true" in str(exc_info.value)


def test_health_reports_mock_firestore(monkeypatch):
    monkeypatch.setenv("USE_MOCK_FIRESTORE", "true")
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["firestore"] == "mock"
