# Architecture

Two tiers with an authenticated, encrypted link and a clear trust boundary.

```
 TIER 1: CUSTOMER ENVIRONMENT (trust boundary)         |      TIER 2: SAAS (multi-tenant, metadata only)
                                                       |
 Sources                                               |
  - psutil (CPU, memory, disk, bandwidth)              |
  - ping (latency, packet loss)                        |
  - sample auth/app logs  (RAW, STAYS LOCAL)           |
        |                                              |
        v                                              |
 [1] Collect -> [2] Redact/Filter -> [3] Aggregate     |
        -> [4] Local analysis (counts, local health)   |
        -> [5] Allow-list payload builder  ----------> local egress log (exact copy + SHA-256)
        -> [6] SQLite buffer + retry                   |
        |                                              |
        |  HTTPS (TLS), Bearer collector key  (hop A)  |
        +----------------------------------------------+--> FastAPI on Render
                                                       |       - verify key (hashed) and tenant
                                                       |       - recompute SHA-256, check schema
                                                       |       - create doc (ID = payload_id)  (hop B)
                                                       |              |
                                                       |              v
                                                       |        Firestore  tenants/{id}/...
                                                       |              |  (hop C: listeners)
                                                       |              v
                                                       |        Dashboard on Vercel (React)
                                                       |         (Firebase Auth, tenant claim)  (hop D)
                                                       |
                                                       |   Render background jobs: watchdog (60 s offline),
                                                       |   anomaly detection, correlation, recommendations
```

## Network hops (each one labeled)
| Hop | From to | Protocol | Auth | Carries |
|---|---|---|---|---|
| A | Collector to Render | HTTPS (TLS) | Bearer collector key + collector ID | Allow-listed payload only |
| B | Render to Firestore | Google API (TLS) | Firebase Admin service account | Validated payloads, alerts, incidents |
| C | Firestore to Dashboard | Firestore listeners (TLS) | Firebase Auth user with tenant claim | Tenant-scoped documents |
| D | Browser to Vercel | HTTPS | Firebase Auth login | Static dashboard app |

## What stays local (never leaves Tier 1)
Raw log lines, usernames, passwords, tokens, API keys, IP addresses, process command lines, file paths, free-form text.

## What may leave
Metric values, UTC timestamps plus source timezone, pseudonymous source IDs, health state, event category, severity, short templated alert context, counts such as auth failures and secrets redacted.

## Reliability design
- Collector writes every payload to a local SQLite queue first, then sends. If the send fails, it retries with exponential backoff and resumes in order after reconnect.
- Idempotency: `payload_id` is the Firestore document ID. A repeat is recognized and answered with 200 `duplicate`. It never creates a second record.
- Out-of-order: data is ordered by `event_time_utc`, not arrival time.
- Offline detection: Render watchdog marks a collector Poor when no heartbeat arrives for 60 s. The dashboard also derives staleness at read time as a backup.

## Egress proof (mandatory)
1. Collector keeps `egress_log` (SQLite or JSONL) with the exact JSON that was sent, its SHA-256 and send status.
2. The backend recomputes the SHA-256 of the received body and stores it with the payload.
3. Dashboard egress panel shows a received payload and its hash. The local collector view shows the sent payload and its hash. The two hashes match.

## Tenant isolation
- All data lives under `tenants/{tenantId}/...`.
- The backend binds the collector key to exactly one tenant and rejects a payload whose `tenant_id` does not match.
- Firestore rules allow a user to read only their tenant (custom claim `tenant_id`). Clients cannot write.

## Global-ready (documented, partly simulated)
- Regional ingest: each tenant has a `region`. The design points collectors to a regional endpoint. We run one real region and show the setting as a label.
- Data residency: tenant data is stored only in its chosen region. Not replicated without policy approval.

## Scale story (design only, not built)
Stateless ingest behind a queue (for example Pub/Sub), one partition per tenant, time-series store for metrics, per-tenant collections.
