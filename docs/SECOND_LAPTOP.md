# Running the Nexus Observe Collector on a Second Windows Laptop

This guide provides the exact steps to install, configure, and execute the Nexus Observe Collector on a second physical or virtual Windows laptop in **real (non-simulated) mode**.

---

## 1. Prerequisites

1. **Install Python 3.12**:
   - Download the official installer from [python.org](https://www.python.org/downloads/).
   - During setup, check **"Add python.exe to PATH"**.
   - Verify in PowerShell:
     ```powershell
     python --version
     ```
2. **Install Git**:
   - Download Git for Windows from [git-scm.com](https://git-scm.com/).
   - Verify in PowerShell:
     ```powershell
     git --version
     ```
3. **Network Connectivity**:
   - Verify that the laptop can reach the SaaS backend URL (e.g. your Render service: `https://<your-backend>.onrender.com/health` or local network IP).

---

## 2. Clone the Repository

In PowerShell:

```powershell
cd C:\Users\<YourUsername>\Desktop
git clone <YOUR_GIT_REPO_URL> nexus-observe
cd nexus-observe
```

---

## 3. Set Up Python Virtual Environment

From the root of `nexus-observe` in PowerShell:

```powershell
# Create virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install collector dependencies
python -m pip install --upgrade pip
pip install -r collector/requirements.txt
```

> **PowerShell Execution Policy**: If script activation is restricted, run:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

---

## 4. Register the Collector in SaaS Backend

Before running the collector on the second laptop, generate its credentials on the backend using the admin script:

```powershell
python -m backend.scripts.create_collector_credential --collector-id col_laptop_02 --tenant-id tenant_acme_demo
```

Output:
```text
============================================================
WARNING: This collector key is shown ONCE and cannot be recovered.
Never commit this key or share it publicly.
============================================================
Collector ID: col_laptop_02
Tenant ID:    tenant_acme_demo
API Key:      <GENERATED_API_KEY>
============================================================
```

This registers the SHA-256 hash in Firestore (`collector_credentials/col_laptop_02`).

---

## 5. Configure `.env` on the Second Laptop

Create a `.env` file in the project root (`nexus-observe\.env`) containing **ONLY** the 6 collector variables:

```env
SAAS_INGEST_URL=https://hackathon-2-09sm.onrender.com/v1/ingest
TENANT_ID=tenant_acme_demo
COLLECTOR_ID=col_laptop_02
COLLECTOR_KEY=<GENERATED_API_KEY>
SOURCE_ROLE=employee_laptop
SEND_INTERVAL_SECONDS=5
```

> **Security Note**: Never commit `.env` or store keys in public locations.

---

## 6. Run the Collector (Real Mode)

Execute the collector in **real mode** (without the `--simulate` flag):

```powershell
python -m collector.collector
```

### Real Mode Behavior:
- **Zero hard-coded IDs**: Reads `COLLECTOR_ID`, `COLLECTOR_KEY`, `TENANT_ID`, `SAAS_INGEST_URL`, `SEND_INTERVAL_SECONDS`, and `SOURCE_ROLE` strictly from `.env`.
- **Pseudonymous Source ID**: Automatically derives `source_id` from a salted SHA-256 hash of the machine hostname (e.g. `src_a1b2c3d4e5`), ensuring privacy and stable identification across reboots.
- **System Metrics**: Gathers actual CPU utilization, memory pressure, disk consumption, and network I/O via `psutil`.
- **Security Audit**: Scans local authentication logs for failed login bursts.
- **Zero-Trust Egress & Buffering**: Strips all unauthorized attributes, validates against the allow-list, logs to local SQLite buffer, and sends payloads in strict sequential FIFO order.

---

## 7. Verify Ingestion on the SaaS Dashboard

1. Sign in to the Nexus Observe web application.
2. In the **Overview** and **Collectors** tabs, verify that the host corresponding to `col_laptop_02` appears with status **Online** and health state **Good**.
3. Confirm that real-time telemetry charts reflect the laptop's live metrics.

To stop the collector, press `Ctrl+C`.
