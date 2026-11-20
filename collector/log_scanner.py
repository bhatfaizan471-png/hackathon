"""
log_scanner.py — Scan a log file for failed-login events.

Returns ONLY: count (int), window_s (int), risk_level (str).
NEVER returns usernames, IPs, or raw log lines.
"""
import re
from pathlib import Path
from typing import TypedDict

from collector.config import load_thresholds

# Patterns that indicate a failed login (case-insensitive)
_FAILED_LOGIN_PATTERNS = [
    re.compile(r'failed\s+login', re.IGNORECASE),
    re.compile(r'authentication\s+failure', re.IGNORECASE),
    re.compile(r'invalid\s+password', re.IGNORECASE),
]


class LoginScanResult(TypedDict):
    count: int
    window_s: int
    risk_level: str


def scan_failed_logins(log_path: str | Path) -> LoginScanResult:
    """
    Count failed-login lines in *log_path*.
    Returns a dict with exactly {count, window_s, risk_level}.
    """
    thresholds = load_thresholds()
    sec_cfg = thresholds.get("security", {})
    window_s: int = sec_cfg.get("window_s", 60)
    fair_at: int = sec_cfg.get("auth_failures_fair_at", 5)
    poor_at: int = sec_cfg.get("auth_failures_poor_at", 20)

    count = 0
    with open(log_path, "r", encoding="utf-8") as f:
        for line in f:
            for pattern in _FAILED_LOGIN_PATTERNS:
                if pattern.search(line):
                    count += 1
                    break  # don't double-count a line matching multiple patterns

    # Determine risk level
    if count == 0:
        risk_level = "none"
    elif count < fair_at:
        risk_level = "low"
    elif count < poor_at:
        risk_level = "medium"
    elif count < poor_at * 2:
        risk_level = "high"
    else:
        risk_level = "critical"

    return LoginScanResult(count=count, window_s=window_s, risk_level=risk_level)
