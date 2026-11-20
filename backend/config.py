import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "hackathon-c30ed")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "./serviceAccount.json")
WATCHDOG_OFFLINE_SECONDS = int(os.getenv("WATCHDOG_OFFLINE_SECONDS", "60"))
PORT = int(os.getenv("PORT", "8000"))
ALLOW_LIST_PATH = ROOT_DIR / "config" / "allow_list.json"
THRESHOLDS_PATH = ROOT_DIR / "config" / "thresholds.json"
