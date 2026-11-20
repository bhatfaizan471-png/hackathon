# NEXUS OBSERVE — Build Progress

> Last updated: 2026-11-20

## Stage Status

| Stage | Name | Status | Notes |
|-------|------|--------|-------|
| 2 | Architecture & Data Contracts | ✅ DONE | Schema validator passes all 3 tests |
| 3 | Collector — core agent | ✅ DONE | 9/9 pytest pass; redactor, buffer, simulator |
| 4 | Backend — FastAPI ingest + Firestore rules | ⬜ TODO | |
| 5 | Dashboard — React / Vite scaffold | ⬜ TODO | |
| 6 | AIOps — anomaly detection, correlation, recommendations | ⬜ TODO | |
| 7 | Integration & end-to-end demo path | ⬜ TODO | |
| 8 | Polish, judging criteria, final commit | ⬜ TODO | |

---

## Stage 3 — Detail

### Exit-gate checklist
- [x] Seeded fake password/API key/email never appears in payload or egress log
- [x] Non-allowed field never reaches payload (allow-list chokepoint)
- [x] Failed-login count returns only count + window_s + risk_level (no usernames/IPs)
- [x] Egress log SHA-256 matches stored JSON exactly
- [x] SQLite queue survives restart and resumes in order
- [x] Simulator produces labelled, schema-valid payloads for 3 fake collectors

### Files created / changed
| File | Action |
|------|--------|
| `collector/__init__.py` | Created |
| `collector/collector.py` | Created — main loop, signal handling, --simulate/--interval |
| `collector/payload_builder.py` | Created — ONE chokepoint: redact → allow-list → SHA-256 → egress log |
| `collector/redactor.py` | Created — regex redaction of passwords, API keys, emails, tokens, IPs |
| `collector/metrics_collector.py` | Created — psutil CPU/RAM/disk/network |
| `collector/network_checker.py` | Created — ping latency/packet loss |
| `collector/service_checker.py` | Created — HTTP availability check |
| `collector/log_scanner.py` | Created — failed-login counter (count+window_s+risk_level only) |
| `collector/sqlite_buffer.py` | Created — SQLite queue with exponential backoff retry |
| `collector/simulator.py` | Created — 3 fake collectors with slow drift |
| `collector/local_view.py` | Created — CLI egress log viewer |
| `collector/config.py` | Created — .env + config JSON loader |
| `collector/requirements.txt` | Updated — pinned versions |
| `collector/tests/__init__.py` | Created |
| `collector/tests/test_redaction.py` | Created — tests 1-4 |
| `collector/tests/test_sqlite_buffer.py` | Created — test 5 |
| `collector/tests/test_simulator.py` | Created — test 6 |
| `collector/tests/fixtures/sample.log` | Created — seeded secrets fixture |
| `config/allow_list.json` | Updated — added heartbeat.simulated |

### Test output

```
platform win32 -- Python 3.12.10, pytest-9.2.0, pluggy-1.7.0
collected 9 items

collector/tests/test_redaction.py::test_seeded_secrets_not_in_payload        PASSED
collector/tests/test_redaction.py::test_non_allowed_field_dropped             PASSED
collector/tests/test_redaction.py::test_failed_login_count_only               PASSED
collector/tests/test_redaction.py::test_egress_log_hash_matches               PASSED
collector/tests/test_simulator.py::test_simulator_produces_three_collectors   PASSED
collector/tests/test_simulator.py::test_simulator_payloads_are_schema_valid   PASSED
collector/tests/test_simulator.py::test_simulator_metrics_in_valid_range      PASSED
collector/tests/test_sqlite_buffer.py::test_sqlite_survives_restart_and_resumes_in_order PASSED
collector/tests/test_sqlite_buffer.py::test_exponential_backoff_increases_delay          PASSED

9 passed in 0.21s
```

### Stage 2 validator still passes
```
[TEST 1/3] Valid payload                ... PASS
[TEST 2/3] Extra forbidden field        ... PASS
[TEST 3/3] Missing required field       ... PASS
All 3 tests passed.
```

---

## Stage 2 — Detail

### Exit-gate checklist
- [x] Schema doc, diagram and config files exist and agree with each other
- [x] `scripts/validate_payload.py` validates sample payloads (valid passes, invalid fails)
- [x] Prerequisites installed and verified
- [x] `docs/PROGRESS.md` created and updated

### Files created / changed
| File | Action |
|------|--------|
| `docs/PROGRESS.md` | Created |
| `docs/PRD.md` | Created |
| `scripts/validate_payload.py` | Created |
| `.gitignore` | Updated (added egg-info, pytest-cache, htmlcov, coverage.xml, *.log) |
| `.env.example` | Updated (Firebase project note, confirmed VITE_ vars) |

### Prerequisite versions (actual)

```
Python  : 3.12.10
Node    : v24.11.0
npm     : 11.6.1
Git     : 2.53.0
Java    : 25.0.2 (openjdk)
Firebase CLI: 15.34.1
```

### Validator test output

```
[TEST 1/3] Valid payload                ... PASS  (exit 0)
[TEST 2/3] Extra forbidden field        ... PASS  (exit 1 — forbidden field detected)
[TEST 3/3] Missing required field       ... PASS  (exit 1 — required field missing)
All 3 tests passed.
```

---

## Permanent rules (see docs/PRD.md for full text)

- One payload builder, one local egress log — they never drift.
- Unknown fields are dropped, never forwarded.
- Free-form log text is never sent.
- Payload ID is the Firestore document ID (idempotent delivery).
- All times UTC (ISO 8601 with Z) + source timezone name.
