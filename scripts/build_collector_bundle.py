"""
build_collector_bundle.py — Package the standalone Nexus Observe Collector ZIP.

Outputs:
  - frontend/public/downloads/nexus-collector.zip
  - frontend/public/downloads/nexus-collector.sha256

The ZIP contains ONLY:
  - collector/ (excluding tests/, fixtures/, __pycache__/, *.pyc, data/*.sqlite)
  - config/ (allow_list.json, thresholds.json)
  - requirements.txt (clean production dependencies)
  - setup.bat (interactive Windows setup)
  - run_collector.bat (one-click run)
  - START_HERE.txt (quick start guide)
  - settings.example.env (sanitized settings template)

Security Scans:
  - Verifies that NO .env, backend/, frontend/, tests/, keys, or database files are packaged.
  - Scans all packaged text files for accidental private keys or secret patterns.
"""
from __future__ import annotations

import hashlib
import os
import re
import sys
import zipfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "frontend" / "public" / "downloads"
ZIP_PATH = OUTPUT_DIR / "nexus-collector.zip"
SHA256_PATH = OUTPUT_DIR / "nexus-collector.sha256"

# Forbidden patterns in paths
FORBIDDEN_PATH_SUBSTRINGS = [
    ".git",
    ".venv",
    "venv",
    "backend",
    "frontend",
    "tests",
    "fixtures",
    "__pycache__",
    ".sqlite",
    ".env",
    "serviceAccount.json",
    ".DS_Store",
]

# Forbidden content patterns
FORBIDDEN_CONTENT_PATTERNS = [
    re.compile(r"BEGIN\s+PRIVATE\s+KEY", re.IGNORECASE),
    re.compile(r"BEGIN\s+RSA\s+PRIVATE\s+KEY", re.IGNORECASE),
    re.compile(r"service_account", re.IGNORECASE),
]


def build_bundle() -> tuple[list[str], int, str]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    if SHA256_PATH.exists():
        SHA256_PATH.unlink()

    entries_to_add: list[tuple[Path, str]] = []

    # 1. Collector source files
    collector_src = PROJECT_ROOT / "collector"
    for path in sorted(collector_src.rglob("*")):
        if path.is_file():
            rel_to_collector = path.relative_to(collector_src)
            # Skip tests, fixtures, pycache, sqlite
            parts = rel_to_collector.parts
            if "tests" in parts or "__pycache__" in parts or "fixtures" in parts:
                continue
            if path.suffix in [".pyc", ".pyo", ".sqlite", ".db"]:
                continue
            archive_name = f"collector/{rel_to_collector.as_posix()}"
            entries_to_add.append((path, archive_name))

    # 2. Config files
    config_dir = PROJECT_ROOT / "config"
    for fname in ["allow_list.json", "thresholds.json"]:
        p = config_dir / fname
        if p.exists():
            entries_to_add.append((p, f"config/{fname}"))
        else:
            raise FileNotFoundError(f"Missing config file: {p}")

    # 3. Requirements, scripts, docs
    root_files = [
        (PROJECT_ROOT / "collector" / "requirements.txt", "requirements.txt"),
        (PROJECT_ROOT / "setup.bat", "setup.bat"),
        (PROJECT_ROOT / "run_collector.bat", "run_collector.bat"),
        (PROJECT_ROOT / "START_HERE.txt", "START_HERE.txt"),
        (PROJECT_ROOT / "settings.example.env", "settings.example.env"),
    ]
    for src, arcname in root_files:
        if not src.exists():
            raise FileNotFoundError(f"Missing file to package: {src}")
        entries_to_add.append((src, arcname))

    # Safety checks on all files before zipping
    print("=" * 60)
    print("NEXUS OBSERVE — Collector Bundle Builder")
    print("=" * 60)
    print("[*] Running security pre-packaging scan...")

    packaged_names = []
    for src, arcname in entries_to_add:
        # Check forbidden substrings in path
        for forbidden in FORBIDDEN_PATH_SUBSTRINGS:
            # allow 'settings.example.env' even though it contains '.env'
            if forbidden == ".env" and arcname == "settings.example.env":
                continue
            if forbidden in arcname:
                raise ValueError(f"SECURITY VIOLATION: Forbidden item '{arcname}' contains '{forbidden}'")

        # Scan text content for leaks
        if src.suffix in [".py", ".json", ".txt", ".bat", ".env", ".md"]:
            try:
                content = src.read_text(encoding="utf-8")
                for pat in FORBIDDEN_CONTENT_PATTERNS:
                    if pat.search(content):
                        raise ValueError(f"SECURITY VIOLATION: Secret pattern detected in '{arcname}'")
            except UnicodeDecodeError:
                pass

        packaged_names.append(arcname)

    # Build ZIP archive with compression
    print(f"[*] Packaging {len(entries_to_add)} files into {ZIP_PATH.name}...")
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for src, arcname in entries_to_add:
            zf.write(src, arcname)

    # Compute SHA-256
    hasher = hashlib.sha256()
    with open(ZIP_PATH, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    digest = hasher.hexdigest()

    # Write .sha256 file
    SHA256_PATH.write_text(f"{digest}  {ZIP_PATH.name}\n", encoding="utf-8")

    zip_size = ZIP_PATH.stat().st_size
    return packaged_names, zip_size, digest


def main():
    try:
        packaged_names, size_bytes, digest = build_bundle()
    except Exception as e:
        print(f"[ERROR] Failed to build collector bundle: {e}")
        sys.exit(1)

    print("=" * 60)
    print("COLLECTOR BUNDLE BUILT SUCCESSFULLY")
    print("=" * 60)
    print(f"Output ZIP   : {ZIP_PATH}")
    print(f"Output Hash  : {SHA256_PATH}")
    print(f"File Size    : {size_bytes:,} bytes ({size_bytes / 1024:.1f} KB)")
    print(f"SHA-256      : {digest}")
    print("-" * 60)
    print(f"Packaged Files ({len(packaged_names)} total):")
    for name in sorted(packaged_names):
        print(f"  + {name}")
    print("=" * 60)


if __name__ == "__main__":
    main()
