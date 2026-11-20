"""
redactor.py — Regex-based secret/PII redaction.

Applied to raw string values BEFORE allow-listing.
Never applied to the final payload itself.
"""
import re
from typing import Tuple

# Ordered list of (pattern, replacement) tuples
_PATTERNS = [
    # Passwords
    (re.compile(r'password\s*[:=]\s*\S+', re.IGNORECASE), '[REDACTED]'),
    (re.compile(r'passwd\s*[:=]\s*\S+', re.IGNORECASE), '[REDACTED]'),
    # API keys
    (re.compile(r'api[_-]?key\s*[:=]\s*\S+', re.IGNORECASE), '[REDACTED]'),
    # Bearer tokens (long enough to be real)
    (re.compile(r'Bearer\s+\S{20,}', re.IGNORECASE), '[REDACTED]'),
    # Tokens / secrets
    (re.compile(r'token\s*[:=]\s*\S+', re.IGNORECASE), '[REDACTED]'),
    (re.compile(r'secret\s*[:=]\s*\S+', re.IGNORECASE), '[REDACTED]'),
    # Emails
    (re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'), '[REDACTED]'),
    # IPs → special marker
    (re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'), '[IP_REMOVED]'),
]


def redact(text: str) -> Tuple[str, int]:
    """
    Apply all redaction patterns to *text*.
    Returns (redacted_text, count_of_substitutions).
    """
    count = 0
    for pattern, replacement in _PATTERNS:
        new_text, n = pattern.subn(replacement, text)
        count += n
        text = new_text
    return text, count


def redact_value(value) -> Tuple[object, int]:
    """
    Redact a single value.  Only strings are processed;
    other types are returned unchanged with count=0.
    """
    if isinstance(value, str):
        return redact(value)
    return value, 0
