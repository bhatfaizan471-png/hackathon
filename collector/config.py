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

load_dotenv(PROJECT_ROOT / ".env")

# ── Thresholds ────────────────────────────────────────────────────────────────
def load_thresholds() -> dict:
    p = PROJECT_ROOT / "config" / "thresholds.json"
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

# ── Allow-list ────────────────────────────────────────────────────────────────
def load_allow_list() -> dict:
    p = PROJECT_ROOT / "config" / "allow_list.json"
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

# ── Runtime settings ──────────────────────────────────────────────────────────
SEND_INTERVAL_SECONDS: int = int(os.getenv("SEND_INTERVAL_SECONDS", "5"))
COLLECTOR_VERSION: str = os.getenv("COLLECTOR_VERSION", "0.3.0")
CONFIG_VERSION: str = os.getenv("CONFIG_VERSION", "1.0")

# Log scanner
LOG_PATH = COLLECTOR_DIR / "tests" / "fixtures" / "sample.log"

# Egress DB
EGRESS_DB_PATH = COLLECTOR_DIR / "data" / "egress.sqlite"
BUFFER_DB_PATH = COLLECTOR_DIR / "data" / "buffer.sqlite"
