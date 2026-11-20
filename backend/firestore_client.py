import os
from typing import Optional, Any
from backend.config import FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS

_db: Optional[Any] = None

class MockDocumentReference:
    def __init__(self, doc_id: str, store_dict: dict):
        self.id = doc_id
        self._store = store_dict

    def get(self, transaction=None):
        exists = self.id in self._store
        data = self._store.get(self.id, {})
        class DocSnapshot:
            def __init__(self, exists: bool, data: dict, doc_id: str):
                self.exists = exists
                self._data = data
                self.id = doc_id
            def to_dict(self):
                return dict(self._data)
        return DocSnapshot(exists, data, self.id)

    def set(self, data: dict, merge: bool = False):
        if merge and self.id in self._store:
            self._store[self.id].update(data)
        else:
            self._store[self.id] = dict(data)

    def update(self, data: dict):
        if self.id in self._store:
            self._store[self.id].update(data)
        else:
            self._store[self.id] = dict(data)

class MockCollectionReference:
    def __init__(self, path: str, root_store: dict):
        self.path = path
        self._root = root_store

    def document(self, doc_id: str):
        if self.path not in self._root:
            self._root[self.path] = {}
        return MockDocumentReference(doc_id, self._root[self.path])

    def limit(self, count: int):
        return self

    def stream(self):
        items = self._root.get(self.path, {})
        class MockItem:
            def __init__(self, doc_id: str, data: dict):
                self.id = doc_id
                self._data = data
            def to_dict(self):
                return dict(self._data)
        return [MockItem(k, v) for k, v in items.items()]

class MockTransaction:
    def __init__(self, db: "MockFirestoreClient"):
        self._db = db

    def get(self, ref):
        # Real Google Cloud Firestore SDK returns a generator yielding snapshots
        yield ref.get()

    def set(self, ref, data: dict, merge: bool = False):
        ref.set(data, merge=merge)

    def update(self, ref, data: dict):
        ref.update(data)

class MockFirestoreClient:
    """In-memory Firestore client used for unit tests or when USE_MOCK_FIRESTORE=true."""
    def __init__(self):
        self._store: dict[str, dict[str, dict]] = {}

    def collection(self, path: str):
        return MockCollectionReference(path, self._store)

    def transaction(self):
        return MockTransaction(self)

    def reset(self):
        self._store.clear()

_mock_db = MockFirestoreClient()

def get_db():
    global _db

    # In-memory mock client returned ONLY when USE_MOCK_FIRESTORE=true
    is_mock_env = os.getenv("USE_MOCK_FIRESTORE", "false").lower() == "true"
    if is_mock_env:
        if _db is not None and isinstance(_db, MockFirestoreClient):
            return _db
        return _mock_db

    # If mock is disabled but _db is currently set to MockFirestoreClient, invalidate it
    if _db is not None and isinstance(_db, MockFirestoreClient):
        _db = None

    if _db is not None:
        return _db

    cred_path = GOOGLE_APPLICATION_CREDENTIALS
    emulator_host = os.getenv("FIRESTORE_EMULATOR_HOST")

    if not emulator_host:
        if not cred_path or not os.path.exists(cred_path):
            raise RuntimeError(
                f"Firestore credentials file not found at '{cred_path}'. "
                f"Set GOOGLE_APPLICATION_CREDENTIALS to a valid service account JSON or set USE_MOCK_FIRESTORE=true for testing."
            )

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            if emulator_host:
                firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID})
            else:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred, options={"projectId": FIREBASE_PROJECT_ID})

        _db = firestore.client()
        return _db
    except Exception as e:
        raise RuntimeError(
            f"Failed to initialize Firestore client for project '{FIREBASE_PROJECT_ID}': {e}"
        ) from e

def set_db(custom_db):
    global _db
    _db = custom_db


def run_transaction(db, callback):
    """
    Executes callback(transaction) in a Firestore transaction.
    Works for both real Google Cloud Firestore client and MockFirestoreClient.
    """
    if isinstance(db, MockFirestoreClient):
        tx = db.transaction()
        return callback(tx)
    else:
        from google.cloud import firestore
        tx = db.transaction()

        @firestore.transactional
        def _in_tx(transaction):
            return callback(transaction)

        return _in_tx(tx)

