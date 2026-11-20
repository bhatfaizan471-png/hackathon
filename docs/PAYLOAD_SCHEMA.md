# Payload schema v1.0

One payload is sent roughly every `SEND_INTERVAL_SECONDS` (default 5). It is the ONLY thing that crosses the trust boundary. The machine-readable allow-list is `config/allow_list.json`.

## Example
```json
{
  "schema_version": "1.0",
  "payload_id": "7b0f6f5e-3a52-4d0b-9f66-0c1d4e5f6a7b",
  "tenant_id": "tenant_acme_demo",
  "collector_id": "col_demo_laptop_01",
  "collector_version": "0.1.0",
  "source_id": "src_a1b2c3d4e5",
  "source_role": "web_server",
  "customer_facing": "login",
  "seq": 1234,
  "event_time_utc": "2026-11-20T14:22:05Z",
  "sent_time_utc": "2026-11-20T14:22:05Z",
  "source_timezone": "Asia/Kolkata",
  "config_version": "cfg-1",
  "heartbeat": { "uptime_s": 86400, "buffer_depth": 0 },
  "metrics": {
    "cpu_percent": 42.5,
    "memory_percent": 61.2,
    "disk_percent": 55.0,
    "net_latency_ms": 38.0,
    "packet_loss_percent": 0.0,
    "bandwidth_in_kbps": 420.0,
    "bandwidth_out_kbps": 180.0,
    "service_up": true
  },
  "security": {
    "auth_failure_count": 12,
    "window_s": 60,
    "risk_level": "high",
    "secrets_redacted_count": 1
  },
  "local_health": { "state": "fair", "reasons": ["auth_failure_count above 5 per minute"] },
  "alerts": [
    { "category": "security", "severity": "high", "context": "12 failed logins in 60 s" }
  ]
}
```

## Fields
| Field | Type | Rules |
|---|---|---|
| schema_version | string | "1.0" |
| payload_id | uuid4 string | Unique per payload; becomes the Firestore document ID |
| tenant_id | string | Must match the tenant bound to the collector key |
| collector_id | string | Pseudonymous collector identifier |
| collector_version | string | Shown in the fleet table |
| source_id | string | `src_` + first 10 hex of SHA-256(salt + hostname). Never the real hostname |
| source_role | enum | employee_laptop, web_server, database_server, app_server, network_device |
| customer_facing | string or null | Optional service label, for example "login", "checkout" |
| seq | integer | Per-collector counter; helps detect gaps |
| event_time_utc | ISO 8601 UTC with Z | Time the data was sampled |
| sent_time_utc | ISO 8601 UTC with Z | Time the collector sent it (used for latency measurement) |
| source_timezone | IANA name | For example Asia/Kolkata |
| config_version | string | Configuration status in the fleet table |
| heartbeat.uptime_s | integer | Collector uptime |
| heartbeat.buffer_depth | integer | Payloads waiting in the local queue |
| metrics.* | numbers/bool | Percent values 0 to 100; latency in ms; bandwidth in kbps |
| security.auth_failure_count | integer | Count only; no usernames, no IPs |
| security.window_s | integer | Counting window |
| security.risk_level | enum | none, low, medium, high, critical |
| security.secrets_redacted_count | integer | How many secrets the redactor removed locally |
| local_health.state | enum | excellent, good, fair, poor |
| local_health.reasons | array of short strings | At most 5, each at most 120 characters |
| alerts[] | array, at most 10 | category (infra, network, security, collector), severity (info, low, medium, high, critical), context (at most 140 chars, templated) |

## Never allowed in a payload
Raw log lines, usernames, passwords, tokens, API keys, IP addresses, real hostnames, file paths, process command lines, free-form text. Unknown fields are dropped by the builder.

## HTTP contract
`POST /v1/ingest` with headers:
- `Authorization: Bearer <collector_key>`
- `X-Collector-Id: <collector_id>`
- `X-Payload-SHA256: <hex sha-256 of the exact request body>`
- `Content-Type: application/json`

Responses: `200 {"status":"accepted"}`, `200 {"status":"duplicate"}`, `401` bad key, `403` tenant mismatch, `422` schema or allow-list violation.

## Ordering and lateness
- Order by `event_time_utc`.
- Events older than 10 minutes are stored and charted but do not change live health state.
- `sent_time_utc` and the dashboard render time are used to measure the 10 s latency target.
