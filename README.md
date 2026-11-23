# NEXUS OBSERVE

Secure, AIOps-driven, two-tier infrastructure observability. Raw data stays in the customer environment; only approved metadata reaches the SaaS.

Built for the CICADA 2026 Smart Observability Hackathon.

---

## ⚡ Quick Start (One Command)

### 1. Clone and Open
```powershell
git clone https://github.com/bhatfaizan471-png/hackathon.git
cd hackathon
code .
```

### 2. Run Complete Platform Locally
```powershell
python scripts/run_local.py
```

This starts:
1. Demo database seeding (tenants and collector credentials).
2. FastAPI SaaS Ingest Server (`http://127.0.0.1:8000`).
3. Autonomous simulated collectors (3 hosts: laptop, web server, DB).

### 3. Launch the Real-Time Dashboard
```powershell
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173).

---

## 💻 Running the Local Host Collector

Nexus Observe Collector streams basic machine health (CPU, RAM, disk, packet loss) without collecting or sending any personal information, usernames, IP addresses, hostnames, or raw logs.

### Option A: Standalone ZIP (Easy Setup for Windows)
1. Download `nexus-collector.zip` from the dashboard or `frontend/public/downloads/nexus-collector.zip`.
2. Extract the ZIP to any folder.
3. Double-click `setup.bat`. Follow the prompts to enter your **Tenant ID**, **Collector ID**, and **Collector Key**.
4. Double-click `run_collector.bat` to begin streaming telemetry.

### Option B: Developer / Git Setup
From the cloned `hackathon` directory:
```powershell
# 1. Create virtual environment and install dependencies
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r collector\requirements.txt

# 2. Configure credentials
copy settings.example.env .env
# Edit .env with your TENANT_ID, COLLECTOR_ID, and COLLECTOR_KEY

# 3. Verify connectivity & authentication
.\.venv\Scripts\python.exe -m collector.check

# 4. Start collector agent
.\.venv\Scripts\python.exe -m collector.collector
```

### Build Standalone Collector Bundle
To generate `nexus-collector.zip` and `nexus-collector.sha256`:
```powershell
python scripts/build_collector_bundle.py
```

---

## 🧪 Testing

Run the full automated test suite:

```powershell
# Python unit, AIOps, and integration tests
.\.venv\Scripts\python.exe -m pytest collector/tests/ -v
.\.venv\Scripts\python.exe -m pytest backend/tests/ -v

# Frontend unit & regression tests
cd frontend ; npm test ; npm run build
```

---

## 📁 Project Structure

```
nexus-observe/
  README.md              <- Quick start & commands
  .env.example           <- Environment template
  firestore.rules        <- Deny-by-default tenant-scoped Firestore rules
  docs/
    PROGRESS.md          <- Real stage verification & progress tracking
    PRD.md               <- Permanent architecture & privacy rules
    DEMO_RUNBOOK.md      <- Judge demonstration walkthrough
    LIMITATIONS.md       <- Honest MVP boundaries & disclosures
    PAYLOAD_SCHEMA.md    <- Single source of truth schema
    ARCHITECTURE.md      <- Two tiers, trust boundary, every network hop
  config/
    allow_list.json      <- Machine-readable allow-list
    thresholds.json      <- Health thresholds & EWMA tuning
  collector/             <- Tier 1 (Python + psutil)
  backend/               <- Tier 2 (FastAPI SaaS + AIOps Engine)
  frontend/              <- Live Dashboard (React + Vite + Tailwind + Recharts)
  scripts/
    run_local.py         <- One-command local runner
    run_benchmarks.py    <- Performance & latency benchmarks
    scenario_injector.py <- Anomaly injector
```

## Stage 2: what to do now (about 1 hour, all 3 members)

1. Install the tools if missing: Python 3.11+, Node 20+, Git, VS Code.
2. In VS Code: File > Open Folder > open this `nexus-observe` folder.
3. Run `git init`, then `git add .` and `git commit -m "Stage 2: contracts"`.
4. Copy `.env.example` to `.env` (we fill it in at Stage 4).
5. All three read these files in order: `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/PAYLOAD_SCHEMA.md`, `docs/FIRESTORE_LAYOUT.md`, then `config/*.json`.
6. Answer the open questions at the bottom of `docs/DECISIONS.md` and agree on who is A, B and C.
7. Create the Firebase project now (Firestore in Native mode). Do not write code yet.
8. Tell Claude "Stage 2 approved" and we start Stage 3.

## Rule for the team

The payload schema and allow-list are the contract between the three parts. If anyone wants to change a field, change it in `docs/PAYLOAD_SCHEMA.md` and `config/allow_list.json` first and tell the others.
