import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "hackathon-5e1a9")
default_creds = "/etc/secrets/serviceAccount.json" if Path("/etc/secrets/serviceAccount.json").exists() else "./serviceAccount.json"
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", default_creds)
WATCHDOG_OFFLINE_SECONDS = int(os.getenv("WATCHDOG_OFFLINE_SECONDS", "45"))
PORT = int(os.getenv("PORT", "8000"))
ALLOW_LIST_PATH = ROOT_DIR / "config" / "allow_list.json"
THRESHOLDS_PATH = ROOT_DIR / "config" / "thresholds.json"

# CORS origins: comma-separated list, defaults to Vite dev server
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "http://localhost:5173")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_RAW.split(",") if origin.strip()]
