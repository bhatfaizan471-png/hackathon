# Decisions (PRD v0.2)

## Locked
| # | Decision |
|---|---|
| D1 | Backend: FastAPI on **Render** (always-on). Dashboard on **Vercel**. Data in **Firestore**. |
| D2 | Live updates: **Firestore listeners** (onSnapshot), not WebSockets. |
| D3 | Anomaly detection: **rolling baseline (EWMA + z-score/MAD)**, no scikit-learn in P0. |
| D4 | Health thresholds: defaults in `config/thresholds.json`, configurable. |
| D5 | Scope: company IT teams only. Monitor employee machines and customer-facing servers. No employee or customer portal. |
| D6 | Customer-impact label on incidents (P1, ~0.5 h). Hosts carry an optional `customer_facing` label. |
| D7 | Secrets and passwords never leave the collector. Allow-listing is the main protection; redaction is the second layer. |

## Principles
1. Every payload is built in ONE place (the collector payload builder). That same function writes the local egress log, so the log can never drift from what was sent.
2. Unknown fields are dropped, never forwarded.
3. Free-form log text is never sent. Alert context is short, templated text.
4. Payload ID is the Firestore document ID (idempotent delivery).
5. All times are UTC (ISO 8601 with Z) plus the source timezone name.

## Open questions (answer in Stage 2)
1. Organizer telemetry stream: what format and how is it delivered (file, HTTP, MQTT)? Until known, we use our own simulator.
2. Team roles: who is A (collector), B (backend and AIOps), C (dashboard)?
3. Is the venue internet reliable? (Decides how much we rely on Render/Vercel versus a local backup run.)
4. Firestore quota: free tier is limited; check current limits and decide whether to enable billing with a budget alert.

## Assumptions
- One real region; the tenant `region` field is a label and the regional ingest design is documented as simulated.
- 2 to 3 demo tenants and 3 to 5 simulated collectors.
