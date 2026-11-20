import os
from typing import Optional, Any
from backend.config import FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS

_db: Optional[Any] = None

class MockDocumentReference:
    def __init__(self, doc_id: str, store_dict: dict):
        self.id = doc_id
        self._store = store_dict

    def get(self):
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
        sub_key = f"{self.path}/{doc_id}"
        if self.path not in self._root:
            self._root[self.path] = {}
        return MockDocumentReference(doc_id, self._root[self.path])

    def stream(self):
        items = self._root.get(self.path, {})
        class MockItem:
            def __init__(self, doc_id: str, data: dict):
                self.id = doc_id
                self._data = data
            def to_dict(self):
                return dict(self._data)
        return [MockItem(k, v) for k, v in items.items()]

class MockFirestoreClient:
    """In-memory Firestore client used for unit tests or when Firestore is unavailable."""
    def __init__(self):
        self._store: dict[str, dict[str, dict]] = {}

    def collection(self, path: str):
        return MockCollectionReference(path, self._store)

    def reset(self):
        self._store.clear()

_mock_db = MockFirestoreClient()

def get_db():
    global _db
    if _db is not None:
        return _db

    # Check if mock mode is forced for unit tests
    if os.getenv("USE_MOCK_FIRESTORE", "false").lower() == "true":
        return _mock_db

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            emulator_host = os.getenv("FIRESTORE_EMULATOR_HOST")
            if emulator_host:
                firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID})
            else:
                cred_path = GOOGLE_APPLICATION_CREDENTIALS
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred, options={"projectId": FIREBASE_PROJECT_ID})
                else:
                    # Initialize default project app for emulator or gcloud default credentials
                    firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID})

        _db = firestore.client()
        return _db
    except Exception as e:
        # Fall back to in-memory mock client if Firestore is not reachable
        return _mock_db

def set_db(custom_db):
    global _db
    _db = custom_db
