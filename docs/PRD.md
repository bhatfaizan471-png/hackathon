# NEXUS OBSERVE — Workspace Rules (PRD condensed)

> This file condenses the permanent rules from the master development prompt.
> Every stage engineer must read and follow these before writing any code.

---

## Section 3 — Trust Boundary & Privacy Rules

1. **Raw log lines, usernames, passwords, tokens, API keys, IP addresses, real hostnames, file paths, and process command lines NEVER leave the collector.** They are redacted locally before the payload is built.
2. The allow-list (`config/allow_list.json`) defines the ONLY fields that may appear in a payload. The payload builder drops everything else silently.
3. Alert `context` is short, templated text — maximum 140 characters. No free-form user content.
4. `source_id` is `src_` + first 10 hex chars of SHA-256(salt + hostname). The real hostname never leaves.
5. `customer_facing` is an optional service label (e.g. "login") — never an IP or hostname.

---

## Section 5 — Payload & Schema Contract

1. **One payload builder, one egress log.** The same function that builds the payload also writes the local egress log. They can never drift.
2. Unknown / extra fields are dropped, never forwarded to the backend.
3. `payload_id` is a UUID4 string and becomes the Firestore document ID → idempotent delivery (repeats get `200 duplicate`, never a second record).
4. All timestamps are **UTC ISO 8601 with Z** (e.g. `2026-11-20T14:22:05Z`), plus `source_timezone` as an IANA name.
5. `seq` is a per-collector monotonically increasing integer — gaps indicate lost payloads.
6. The backend recomputes SHA-256 of the received body and stores it; the collector sends the same hash in `X-Payload-SHA256`. They must match.
7. Payloads are ordered by `event_time_utc`, not arrival time. Events older than 10 min are stored but do not change live health state.
8. Schema version is `"1.0"`. Any new field requires a schema version bump and a migration plan.

---

## Section 8 — Architecture & Technology Decisions (locked)

| ID | Decision |
|----|----------|
| D1 | Backend: **FastAPI on Render** (always-on). Dashboard: **Vercel**. Data: **Firestore**. |
| D2 | Live updates: **Firestore onSnapshot listeners** — not WebSockets. |
| D3 | Anomaly detection: **rolling baseline (EWMA + z-score/MAD)** — no scikit-learn in P0. |
| D4 | Health thresholds in `config/thresholds.json`, configurable per deployment. |
| D5 | Scope: company IT teams only. No employee or customer portal. |
| D6 | Customer-impact label on incidents. Hosts carry optional `customer_facing` label. |
| D7 | Secrets/passwords never leave the collector. Allow-listing is primary protection; redaction is secondary. |

**Network hops (never change without updating ARCHITECTURE.md):**

| Hop | From → To | Protocol | Auth |
|-----|-----------|----------|------|
| A | Collector → Render | HTTPS (TLS) | Bearer collector key + collector ID |
| B | Render → Firestore | Google API (TLS) | Firebase Admin service account |
| C | Firestore → Dashboard | Firestore listeners (TLS) | Firebase Auth user with `tenant_id` claim |
| D | Browser → Vercel | HTTPS | Firebase Auth login |

**Firestore tenant isolation:** All data under `tenants/{tenantId}/**`. A user may only read their own tenant (custom claim `tenant_id`). No client writes.

---

## Section 11 — Reliability & Egress Proof Requirements

1. **SQLite buffer + retry.** The collector writes every payload to a local SQLite queue *before* sending. On failure it retries with exponential backoff and resumes in order after reconnect.
2. **Idempotent delivery.** `payload_id` is the Firestore document ID. A duplicate payload returns `200 {"status":"duplicate"}` and creates no second record.
3. **Egress proof** (must be demo-able):
   - Collector keeps an `egress_log` (SQLite or JSONL) with the exact JSON sent, its SHA-256, and send status.
   - Backend recomputes SHA-256 and stores it.
   - Dashboard egress panel shows received payload + hash; collector shows sent payload + hash. **The hashes must match.**
4. **Offline detection.** Render watchdog marks a collector `offline` when no heartbeat arrives for 60 s. The dashboard also derives staleness at read time.
5. **Out-of-order tolerance.** Data ordered by `event_time_utc`, not arrival. Stale events (>10 min old) stored but excluded from live health state.
6. **10-second latency target.** Collection-to-dashboard p95 must be ≤10 s. Measure using `sent_time_utc` and dashboard render time.
7. **Firestore quota.** One write per payload per collector every 5 s. Add a budget alert if billing is enabled.

---

## Firebase Project

- **Project ID:** `hackathon-5e1a9`
- **Region:** default (us-central1 for Firestore unless overridden)
- **Auth domain:** `hackathon-5e1a9.firebaseapp.com`

---

## Stack Quick-reference

| Component | Technology | Host |
|-----------|-----------|------|
| Collector | Python 3.12, psutil, requests, SQLite | Customer machine |
| Backend | FastAPI, Firebase Admin SDK | Render (always-on) |
| Dashboard | React 18, Vite, Firebase JS SDK v9 | Vercel |
| Data store | Firestore (Spark / pay-as-you-go) | Google Cloud |
| Auth | Firebase Auth (email/password) | Google Cloud |
| Config | `config/allow_list.json`, `config/thresholds.json` | Repo |
