# Firestore layout

Everything customer-related lives under `tenants/{tenantId}`. Only the backend (Admin SDK) writes. Dashboard users only read their own tenant.

```
tenants/{tenantId}
  name, region, created_at_utc

tenants/{tenantId}/collectors/{collectorId}
  source_id, source_role, customer_facing, collector_version, config_version
  status            (online | offline)
  health_state      (excellent | good | fair | poor)
  health_reasons[]
  last_seen_utc, cpu_percent, memory_percent, buffer_depth

tenants/{tenantId}/payloads/{payload_id}       <- doc ID = payload_id (idempotency)
  ...the validated payload fields...
  received_time_utc, payload_sha256, ingest_latency_ms

tenants/{tenantId}/alerts/{alertId}
  source_id, category, severity, context, event_time_utc, created_time_utc, incident_id

tenants/{tenantId}/incidents/{incidentId}
  title, status, severity, priority_score
  affected_sources[], customer_impact
  alert_ids[], started_utc, updated_utc
  explanation { signals[], scores, confidence, reasoning[] }
  recommendation { action, rationale, rollback_plan }

tenants/{tenantId}/health_events/{eventId}
  source_id, from_state, to_state, reason, time_utc

tenants/{tenantId}/baselines/{sourceId__metric}
  ewma, spread, count, updated_utc          (survives Render restarts)

tenants/{tenantId}/audit/{auditId}
  incident_id, action, approved_by, policy_check, simulated, rollback_plan, time_utc

collector_credentials/{collectorId}            <- SERVER ONLY, no client access
  tenant_id, key_hash, created_at_utc, active
```

## Rules (summary; written in Stage 4)
- Default: deny all.
- A signed-in user may read `tenants/{t}/**` only when their token claim `tenant_id` equals `t`.
- No client writes anywhere, except none are needed in the prototype.
- `collector_credentials` is never readable by clients.

## Notes
- Query charts with `orderBy(event_time_utc)`, limited to the last N minutes. Create the needed composite indexes when Firestore asks.
- Quota: one write per payload per collector every 5 s. Free quota is limited, so run collectors only while testing and add a budget alert if billing is enabled.
