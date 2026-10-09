# FUSION Prototype

This repository contains a local prototype for a permissioned blockchain-inspired KYC fraud investigation workspace.

## Structure

- `backend/` – FastAPI service with seeded demo users, case workflows, verification logic, and a simulated blockchain adapter.
- `frontend/` – React/Vite UI for logging in and reviewing case activity.
- `blockchain/` – simulator artifacts and any blockchain-adjacent helpers.

## Run the backend

```bash
pip install -r requirements.txt
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

## Demo login

- `alpha.officer / alpha.officer!123!`
- `beta.investigator / beta.investigator!123!`
- `gamma.auditor / gamma.auditor!123!`

## Important note

The blockchain layer is a local simulator, not a real Hyperledger Fabric or production-grade blockchain deployment. Case workflow events create simulated transactions that are persisted in the local SQLite database and referenced in the case history and audit trail. Check `GET /api/v1/blockchain/status` for the simulator mode and persisted transaction count. The `ledger_ready` flag only means the local simulator can accept events; it does not indicate that a blockchain network is running.
