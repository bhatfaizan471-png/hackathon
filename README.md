# NEXUS OBSERVE

Secure, AIOps-driven, two-tier observability. Raw data stays in the customer environment; only approved metadata reaches the SaaS.

CICADA 2026 hackathon project. Build budget: 15 hours.

## Folder structure

```
nexus-observe/
  README.md              <- you are here
  .env.example           <- copy to .env (never commit .env)
  .gitignore
  docs/
    DECISIONS.md         <- locked decisions and open questions
    ARCHITECTURE.md      <- two tiers, trust boundary, every network hop
    PAYLOAD_SCHEMA.md    <- the exact payload the collector sends
    FIRESTORE_LAYOUT.md  <- collections, document IDs, tenant rules
  config/
    allow_list.json      <- fields allowed to leave the collector
    thresholds.json      <- health-state thresholds (configurable)
  collector/             <- Tier 1 (Python + psutil)      Stage 3
  backend/               <- Tier 2 (FastAPI on Render)    Stage 4, 6
  frontend/              <- Dashboard (React + Vite)      Stage 5
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
