import os
import pytest
from backend.firestore_client import MockFirestoreClient, set_db
from backend.seed import seed_database

@pytest.fixture(autouse=True)
def setup_mock_db():
    """Sets up fresh in-memory mock Firestore for each test."""
    os.environ["USE_MOCK_FIRESTORE"] = "true"
    mock_db = MockFirestoreClient()
    set_db(mock_db)
    seed_database()
    yield mock_db
