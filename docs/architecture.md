# FUSION System Architecture

```mermaid
graph TD
    subgraph Frontend [React 18 + Vite + Tailwind CSS]
        UI[FUSION Dashboard & Workbench]
        Auth[RBAC & Org Context Switcher]
        Pages[KYC Verification / Cases / Audit Explorer]
    end

    subgraph Backend [FastAPI Gateway & Services]
        API[FastAPI Core Router]
        AuthSvc[PBKDF2 Auth & Session Manager]
        RiskEng[Deterministic Risk Assessment Engine]
        EvidenceMgr[Evidence Commitment & Integrity Verifier]
        DB[(SQLite / PostgreSQL Database)]
    end

    subgraph Ledger [Permissioned Blockchain Layer]
        Sim[Blockchain Simulator / In-Memory & Persisted Ledger]
        CC[Hyperledger Fabric Chaincode (Go Contract)]
        Channel[Channel: fusion-kyc-channel]
    end

    UI -->|REST / Bearer Token| API
    API --> AuthSvc
    API --> RiskEng
    API --> EvidenceMgr
    API --> DB
    API -->|Append-Only Events & Commitments| Sim
    Sim -.->|Production Target| CC
    CC --- Channel
```

## Core Modules
1. **Frontend**: Modern banking security interface with real-time risk charts (Recharts), step-by-step verification wizard, case sharing workflows, and cryptographic evidence audit explorer.
2. **Backend**: FastAPI REST service with modular endpoints for auth, KYC sessions, case lifecycle, evidence hashing, and blockchain audit queries.
3. **Risk Engine**: Explainable, rule-based scoring engine that assesses deepfake liveness, document integrity, voice clone suspicion, and face matching. Handles missing detectors fail-safely.
4. **Blockchain Layer**:
   - **Simulator (`backend/app/services/blockchain_simulator.py` & `blockchain/simulator/ledger.py`)**: Local append-only ledger emulating Fabric chaincode behavior with transaction hashing and simulation banners.
   - **Hyperledger Fabric Chaincode (`blockchain/chaincode/fusion.go`)**: Production Go smart contract implementing 14 cross-bank collaboration functions, access policies, and commitment verification.
