# NEXUS OBSERVE — Build Progress

> Last updated: 2026-11-20

## Stage Status

| Stage | Name | Status | Notes |
|-------|------|--------|-------|
| 2 | Architecture & Data Contracts | ✅ DONE | Schema validator passes all 3 tests |
| 3 | Collector — core agent | ⬜ TODO | |
| 4 | Backend — FastAPI ingest + Firestore rules | ⬜ TODO | |
| 5 | Dashboard — React / Vite scaffold | ⬜ TODO | |
| 6 | AIOps — anomaly detection, correlation, recommendations | ⬜ TODO | |
| 7 | Integration & end-to-end demo path | ⬜ TODO | |
| 8 | Polish, judging criteria, final commit | ⬜ TODO | |

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
