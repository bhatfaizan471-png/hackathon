"""
service_checker.py — HTTP availability check.
"""
from __future__ import annotations

import requests


def check_service(url: str, timeout: float = 5.0) -> bool:
    """
    Return True if *url* responds with 2xx/3xx within *timeout* seconds.
    """
    try:
        resp = requests.get(url, timeout=timeout, allow_redirects=True)
        return resp.status_code < 500
    except requests.RequestException:
        return False
