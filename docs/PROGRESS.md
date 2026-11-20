# NEXUS OBSERVE — Build Progress

> Last updated: 2026-11-21

## Stage Status

| Stage | Name | Status | Notes |
|-------|------|--------|-------|
| 2 | Architecture & Data Contracts | ✅ DONE | Schema validator passes all 3 tests |
| 3 | Collector — core agent | ✅ DONE | 9/9 pytest pass; redactor, buffer, simulator |
| 4 | Backend — FastAPI ingest + Firestore rules | ✅ DONE | 7/7 pytest pass; auth, tenant isolation, watchdog, seed |
| 5 | Dashboard — React / Vite scaffold | ✅ DONE | 5/5 Vitest pass; build clean; onSnapshot, egress proof |
| 6 | AIOps — anomaly detection, correlation, recommendations | ✅ DONE | 4/4 pytest pass; EWMA Z-score, cooldown, incidents |
| 7 | Integration & end-to-end demo path | ✅ DONE | 12/12 demo tests pass; Section 13 metrics measured |
| 8 | Polish, judging criteria, final commit | ✅ DONE | Remediation audit, runbook, limitations, all green |
| + | Optimization & Tenant Claims | ✅ DONE | 30/30 pytest pass, Auth claims, 5-min buffer measurement (avg 0.0) |

---

## Post-Stage 8 Optimizations & Verification (2026-11-21)

### Exit-gate checklist
- [x] Part A: Removed `getAnalytics` and unused analytics dependencies from `frontend/src/firebase.js`; all config strictly sourced from `import.meta.env.VITE_*`.
- [x] Part B: Fixed collector bottleneck by replacing sequential sends with concurrent per-collector worker queues and HTTP keep-alive connection pooling.
- [x] Part B: 5-minute continuous run (60 ticks, 180 payloads) completed: steady-state `buffer_depth` stays strictly at **0** (never exceeds 1).

### 5-Minute Buffer Depth Measurement Results
- **Duration**: 300 seconds (5 minutes)
- **Interval**: 5 seconds (60 ticks)
- **Total Payloads Sent**: 180 (3 concurrent collectors per tick)
- **Min Steady-State Depth**: 0
- **Max Steady-State Depth**: 0
- **Average Steady-State Depth**: 0.00
- **Result**: PASS (steady-state depth <= 1)

---

## Stage 8 — Detail

### Exit-gate checklist
- [x] Remediation approval produces audit entry and rollback text; nothing real is executed (`simulated: true, real_execution: false`)
- [x] Full demo script runs end to end twice with zero errors
- [x] Deployed frontend configuration verified for Vercel; backend configuration in `render.yaml`
- [x] Backup local run works with one command: `python scripts/run_local.py`
- [x] Limitations listed honestly in `docs/LIMITATIONS.md` (redaction boundaries, simulated regions, free quota warnings)

### Files created / changed
| File | Action |
|------|--------|
| `backend/remediation.py` | Created — policy check, simulated execution & immutable audit |
| `backend/main.py` | Updated — registered remediation endpoints |
| `backend/tests/test_remediation.py` | Created — unit test for policy check & rollback generation |
| `scripts/run_local.py` | Created — single-command orchestrator for local demo |
| `docs/DEMO_RUNBOOK.md` | Created — step-by-step judge demonstration guide |
| `docs/LIMITATIONS.md` | Created — honest MVP disclosures |
| `README.md` | Updated — quick start guide and one-command execution |

### Master Regression Test Summary
- Schema validator (`scripts/validate_payload.py --test`): **3/3 PASS**
- Collector tests (`collector/tests/`): **9/9 PASS**
- Backend & AIOps tests (`backend/tests/`): **13/13 PASS**
- Frontend unit tests (`npm test`): **5/5 PASS**
- Frontend build (`npm run build`): **100% CLEAN**

---

## Stage 7 — Detail

### Exit-gate checklist
- [x] Section 12 tests 1–12 all pass:
  1. CPU spike to 95% creates alert
  2. Website/API failure creates alert
  3. Network latency increase creates alert
  4. Repeated failed logins create security alert without usernames or IPs
  5. A stopped collector becomes Poor within 60 seconds
  6. A fake API key in local log is removed locally and never in Firestore (full document scan verified)
  7. Egress panel matches received payload (hash MATCH)
  8. Offline buffering & retry give zero loss and zero duplicates
  9. Company A cannot access Company B's data (403 forbidden)
  10. Multiple related alerts become one incident with probabilistic explanation
  11. Replayed payloads create no duplicates; shuffled arrival correct
  12. Brief normal bump is not flagged; sustained spike is
- [x] Section 13 performance targets measured:
  - Collection to dashboard p95: **4.20s** (target <= 10s)
  - Threshold breach to alert: **0.050s** (target <= 15s)
  - Collector offline to Poor: **60.0s** (target <= 60s)
  - Backlog delivery: **50/50 received, zero loss, zero duplicates**
- [x] Automated check proves seeded secrets (`SuperSecret123`, `sk-prod-abc123xyz789`, `john.doe@example.com`, `192.168.1.42`) appear nowhere in Firestore.

### Files created / changed
| File | Action |
|------|--------|
| `scripts/scenario_injector.py` | Created — anomaly injector CLI |
| `scripts/run_benchmarks.py` | Created — performance target benchmark |
| `backend/tests/test_e2e_12_demo.py` | Created — 12-test automated validation suite |

### Test output
```
backend/tests/test_e2e_12_demo.py::test_demo_1_to_12_and_targets PASSED [100%]
=== Section 13 Performance Target Measurements ===
Collection to Dashboard p95: 4.20s (Target <= 10s) -> PASS
Threshold Breach to Alert: 0.050s (Target <= 15s) -> PASS
Collector Offline to Poor: 60.0s (Target <= 60s) -> PASS
Backlog Delivery: 50/50 received, 0 duplicates -> PASS
```

---

## Stage 6 — Detail

### Exit-gate checklist
- [x] Injected sustained CPU spike to 95% creates an alert with explanation
- [x] Brief normal CPU bump creates NO alert
- [x] Repeated alerts inside the cooldown are suppressed
- [x] CPU + latency + service alerts on one host within 2 minutes become exactly one incident
- [x] Every incident shows signals, scores, rule, confidence, reasoning; wording says "probable cause"
- [x] Every state transition is logged in UTC with a reason

### Files created / changed
| File | Action |
|------|--------|
| `backend/aiops/__init__.py` | Created |
| `backend/aiops/anomaly_detector.py` | Created — EWMA + Z-score anomaly detector |
| `backend/aiops/alert_manager.py` | Created — 120s cooldown suppression |
| `backend/aiops/correlator.py` | Created — multi-signal 2-min clustering & probabilistic cause synthesis |
| `backend/aiops/health_engine.py` | Created — 4-tier product health state evaluator & UTC history logger |
| `backend/aiops/processor.py` | Created — telemetry ingest pipeline processor |
| `backend/ingest.py` | Updated — connected AIOps processing on ingest |
| `backend/tests/test_aiops.py` | Created — tests 1-6 |

### Test output
```
backend/tests/test_aiops.py::test_1_and_2_sustained_spike_vs_brief_bump PASSED
backend/tests/test_aiops.py::test_3_cooldown_suppression PASSED
backend/tests/test_aiops.py::test_4_and_5_correlation_and_explainable_recommendation PASSED
backend/tests/test_aiops.py::test_6_state_transition_logged_in_utc_with_reason PASSED
4 passed in 0.04s
```

---

## Stage 5 — Detail

### Exit-gate checklist
- [x] `npm run build` and Vitest pass with no errors
- [x] Dashboard shows data written through Firestore listeners, not hard-coded data
- [x] Live data listeners update dynamically on telemetry arrival
- [x] Stale data shows Fair/Poor, never healthy (calculated at render time)
- [x] Egress panel shows MATCH for authentic payload and MISMATCH for tampered one
- [x] Logged-in Company A user views only Company A telemetry

### Files created / changed
| File | Action |
|------|--------|
| `frontend/src/utils/staleness.js` | Created — staleness calculation (>15s Fair, >60s Poor) |
| `frontend/src/utils/crypto.js` | Created — browser SHA-256 via SubtleCrypto |
| `frontend/src/context/TenantContext.jsx` | Created — multi-tenant isolation & live Firestore listeners |
| `frontend/src/components/Navbar.jsx` | Created — tenant selector, status indicator, navigation |
| `frontend/src/components/Overview.jsx` | Created — fleet health score, KPI summary cards |
| `frontend/src/components/FleetTable.jsx` | Created — collector inventory with staleness & health reasons |
| `frontend/src/components/InfraView.jsx` | Created — CPU/RAM/Disk Recharts with threshold bands |
| `frontend/src/components/NetworkView.jsx` | Created — ping latency, packet loss, bandwidth |
| `frontend/src/components/ApplicationView.jsx` | Created — customer-facing endpoint health |
| `frontend/src/components/SecurityView.jsx` | Created — auth failure charts & zero-PII egress proof |
| `frontend/src/components/IncidentsView.jsx` | Created — AIOps correlated incidents & recommendations |
| `frontend/src/components/HealthHistoryView.jsx` | Created — transition timeline log |
| `frontend/src/components/EgressPanel.jsx` | Created — cryptographic egress SHA-256 validation |
| `frontend/src/App.jsx` | Updated — tabbed application dashboard |
| `frontend/src/tests/dashboard.test.jsx` | Created — unit & regression tests |

### Test output
```
✓ src/tests/dashboard.test.jsx (5 tests) 12ms
Test Files  1 passed (1)
Tests       5 passed (5)
Duration    3.04s
✓ built in 9.94s
```

---

## Stage 4 — Detail

### Exit-gate checklist
- [x] Bad or missing API key returns 401
- [x] Collector cannot write into another tenant (tenant validated server-side -> 403)
- [x] Sending same payload twice creates exactly one document (idempotent, returns status: duplicate)
- [x] Out-of-order payloads stored with correct event_time_utc
- [x] Unknown fields dropped; forbidden fields rejected (422)
- [x] Rules test: Company A cannot read Company B; client writes denied
- [x] Watchdog marks silent collector Poor within 60s
- [x] Daily write count reported (~17,280/day telemetry)

### Files created / changed
| File | Action |
|------|--------|
| `backend/__init__.py` | Created |
| `backend/config.py` | Created |
| `backend/firestore_client.py` | Created — Admin SDK & mock fallback |
| `backend/auth.py` | Created — Bearer key & SHA-256 verification |
| `backend/schema_validator.py` | Created — allow_list & forbidden filter |
| `backend/ingest.py` | Created — POST /v1/ingest endpoint |
| `backend/watchdog.py` | Created — 60s silent collector monitor |
| `backend/main.py` | Created — FastAPI app & lifespan |
| `backend/seed.py` | Created — demo tenants & collector secrets |
| `firestore.rules` | Created — deny-by-default, tenant claim auth |
| `firebase.json` | Created — emulator configuration |
| `firestore.indexes.json` | Created — composite indexes |
| `.firebaserc` | Created — default project alias |
| `render.yaml` | Created — Render deploy configuration |
| `backend/tests/test_ingest.py` | Created — tests 1-5 |
| `backend/tests/test_rules.py` | Created — test 6 |
| `backend/tests/test_watchdog.py` | Created — test 7 |

### Test output
```
backend/tests/test_ingest.py::test_1_bad_or_missing_api_key_returns_401 PASSED
backend/tests/test_ingest.py::test_2_tenant_mismatch_returns_403 PASSED
backend/tests/test_ingest.py::test_3_idempotent_duplicate_payload PASSED
backend/tests/test_ingest.py::test_4_out_of_order_payloads_store_event_time_utc PASSED
backend/tests/test_ingest.py::test_5_unknown_fields_dropped_and_forbidden_rejected PASSED
backend/tests/test_rules.py::test_6_firestore_rules_tenant_isolation_and_write_denial PASSED
backend/tests/test_watchdog.py::test_7_watchdog_marks_silent_collector_poor_after_60s PASSED
7 passed in 0.69s
```

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
