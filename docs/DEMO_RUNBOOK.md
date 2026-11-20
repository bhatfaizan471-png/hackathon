# NEXUS OBSERVE — Judge & Demo Runbook

> **Target Question from Judges:**
> *"Can you show exactly what your collector sends to the SaaS, prove sensitive and raw data stays local, and show how AIOps turns metadata into an actionable recommendation?"*

---

## 1. Fast Local Demonstration (One Command)

To run the complete platform locally:

```bash
python scripts/run_local.py
```

In another terminal, launch the dashboard:
```bash
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

---

## 2. Key Demo Talking Points & Proof Steps

### Proof Step A: The Egress Proof Panel (Zero Secret Leak)
1. In the Dashboard, click **Egress Proof** on the top navigation.
2. Note the two SHA-256 hashes:
   - **Tier 1 Sent SHA-256**: calculated from the raw SQLite egress log on the collector.
   - **SaaS Computed Received SHA-256**: recalculated independently by FastAPI upon receiving the JSON body.
3. Observe the green **HASH MATCH (AUTHENTIC)** badge.
4. Click **Inject Fake Secret (Tamper Demo)**.
   - A simulated credential leak (`leak_injected_password: "StolenCredentials123"`) is injected into the payload.
   - The badge immediately flips to **HASH MISMATCH (TAMPERED)** in red.
   - Demonstrates that any tampering or unapproved data alteration is detected cryptographically.

### Proof Step B: Zero-PII Security Monitoring
1. Click the **Security** tab.
2. Observe the failed login counter.
3. Show the judges:
   - Only counts (`auth_failure_count: 12`) and risk classifications (`risk_level: "high"`) are displayed.
   - **No usernames**, **no IP addresses**, and **no passwords** exist in the SaaS database.
   - The local log file (`sample.log`) contained `user=admin`, `10.0.0.5`, `password=SuperSecret123` — all scrubbed by Tier 1 redactor.

### Proof Step C: AIOps Multi-Signal Correlation & Explainable Recommendation
1. Click **Incidents & AIOps**.
2. Point out the correlated incident synthesized from concurrent CPU and Latency anomalies within a 2-minute window.
3. Review the **Probable Cause** explanation:
   - Signals: `infra`, `network`
   - Confidence: `92%`
   - Probabilistic wording: *"Probable cause: compute resource saturation leading to cascading network response latency"*.
4. Show the **Actionable Recommendation**:
   - Suggested Action: *"Scale worker instance pool or restart runaway worker thread"*
   - Rollback Plan: *"Revert autoscaling group max-capacity back to initial threshold if p95 latency remains unrecovered"*

### Proof Step D: Four Product Health States & Staleness Handling
1. Click the **Fleet** tab.
2. Show health badges: **Excellent**, **Good**, **Fair**, **Poor**.
3. Point out that a collector that misses 3 intervals (>15s) automatically degrades to **Fair**.
4. When a collector stops reporting for >60s, the background watchdog or frontend staleness evaluator marks it **Poor** (never healthy).

---

## 3. Cloud Deployment (Render + Vercel)

- **Backend on Render**: Uses `render.yaml` blueprint with Python 3.12, uvicorn, and Firestore Admin SDK.
- **Frontend on Vercel**: Connects to the Firebase project `hackathon-5e1a9` using live Firestore `onSnapshot` listeners.
