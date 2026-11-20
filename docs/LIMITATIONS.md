# NEXUS OBSERVE — Honest Limitations & MVP Boundaries

In accordance with Section 10 (Stage 8 exit gate), these limitations are documented transparently:

1. **Regex Redaction Scope**:
   - The Tier 1 collector employs a multi-pattern regex engine for known credential formats (Bearer tokens, API keys matching standard prefixes, email addresses, IPv4 addresses, and password assignments).
   - *Limitation:* Highly bespoke, unstructured, or novel token formats without key-value indicators may evade pure regex redaction. The primary defense remains strict schema allow-listing (dropping all unknown fields).

2. **Simulated Multi-Region Ingest**:
   - The tenant `region` field (e.g. `asia-south1 (simulated)`) represents data residency intent. In the hackathon prototype, ingest routes to a single primary regional cluster. True multi-cloud edge termination is simulated.

3. **Autonomous Remediation Safeguard**:
   - Remediation actions (e.g. `scale_worker_pool`, `restart_runaway_worker`) produce verified, immutable audit log entries in `tenants/{tenant_id}/audit` and full rollback plans.
   - *Design Choice:* To prevent accidental destructive operations on host machines during live demonstrations, actions execute in simulation mode (`simulated: true, real_execution: false`).

4. **Firestore Free Tier Quotas**:
   - With 3 simulated collectors polling at 5-second intervals, daily writes approach ~17,500 operations. Extended testing should configure `SEND_INTERVAL_SECONDS=10` to remain safely below the 20,000 free-tier daily write limit.
