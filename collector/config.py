"""
config.py — Load .env and config JSON files.
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

# Project root is two levels up from this file
PROJECT_ROOT = Path(__file__).resolve().parent.parent
COLLECTOR_DIR = Path(__file__).resolve().parent

# Load .env from cwd, collector directory, or project root
for env_candidate in [Path.cwd() / ".env", COLLECTOR_DIR / ".env", PROJECT_ROOT / ".env"]:
    if env_candidate.exists():
        load_dotenv(env_candidate)
        break
else:
    load_dotenv()

# ── Thresholds ────────────────────────────────────────────────────────────────
def load_thresholds() -> dict:
    candidates = [
        PROJECT_ROOT / "config" / "thresholds.json",
        COLLECTOR_DIR / "config" / "thresholds.json",
        COLLECTOR_DIR.parent / "config" / "thresholds.json",
        Path.cwd() / "config" / "thresholds.json",
    ]
    for p in candidates:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError("Could not find thresholds.json in any expected config path")

# ── Allow-list ────────────────────────────────────────────────────────────────
def load_allow_list() -> dict:
    candidates = [
        PROJECT_ROOT / "config" / "allow_list.json",
        COLLECTOR_DIR / "config" / "allow_list.json",
        COLLECTOR_DIR.parent / "config" / "allow_list.json",
        Path.cwd() / "config" / "allow_list.json",
    ]
    for p in candidates:
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    raise FileNotFoundError("Could not find allow_list.json in any expected config path")

# ── Runtime settings ──────────────────────────────────────────────────────────
SEND_INTERVAL_SECONDS: int = int(os.getenv("SEND_INTERVAL_SECONDS", "5"))
COLLECTOR_VERSION: str = os.getenv("COLLECTOR_VERSION", "0.3.0")
CONFIG_VERSION: str = os.getenv("CONFIG_VERSION", "1.0")

# Log scanner
LOG_PATH = COLLECTOR_DIR / "tests" / "fixtures" / "sample.log"

# Egress DB
EGRESS_DB_PATH = COLLECTOR_DIR / "data" / "egress.sqlite"
BUFFER_DB_PATH = COLLECTOR_DIR / "data" / "buffer.sqlite"

# Collector and SaaS defaults
SAAS_INGEST_URL: str = os.getenv("SAAS_INGEST_URL", "http://localhost:8000/v1/ingest")
COLLECTOR_KEY: str = os.getenv("COLLECTOR_KEY", "")
COLLECTOR_ID: str = os.getenv("COLLECTOR_ID", "col_demo_laptop_01")
TENANT_ID: str = os.getenv("TENANT_ID", "tenant_acme_demo")
SOURCE_ROLE: str = os.getenv("SOURCE_ROLE", "employee_laptop")
