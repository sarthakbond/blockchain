"""
FUSION Blockchain Chaincode Simulator
======================================
⚠️  SIMULATION — NOT A REAL BLOCKCHAIN ⚠️

This module simulates Hyperledger Fabric chaincode function behaviour in
Python for local development and testing.  No Fabric peer, orderer, or
certificate authority is used.  All ledger operations are in-memory.

For a production Hyperledger Fabric deployment, replace this adapter with
one that:
  1. Connects to a Fabric Gateway (Fabric SDK Go / Node) via gRPC.
  2. Submits transactions using the signed identity of the acting bank MSP.
  3. Reads ledger state from the channel world-state database.
  4. Uses private data collections for restricted case data.
  5. Enforces endorsement policies (e.g. Majority of ALPHA + BETA MSPs).

Chaincode functions implemented (simulated):
  - CreateVerificationRecord
  - CreateFraudCase
  - ShareCase
  - AcknowledgeCase
  - SubmitReviewFinding
  - RequestAdditionalInformation
  - DisputeCase
  - EscalateCase
  - ResolveCase
  - CloseCaseWithoutFinding
  - AppendCorrection
  - GetAuthorizedCaseSummary
  - GetCaseHistory
  - VerifyEvidenceCommitment
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ─── Ledger state ──────────────────────────────────────────────────────────────

class LedgerState:
    """In-memory world-state and history log (replaces CouchDB / LevelDB)."""

    def __init__(self) -> None:
        self._state: Dict[str, Dict[str, Any]] = {}
        self._history: Dict[str, List[Dict[str, Any]]] = {}
        self._transactions: List[Dict[str, Any]] = []

    def put(self, key: str, value: Dict[str, Any]) -> None:
        self._state[key] = value
        self._history.setdefault(key, []).append({
            "tx_id": f"sim-tx-{uuid.uuid4().hex}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "value": value,
        })

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        return self._state.get(key)

    def get_history(self, key: str) -> List[Dict[str, Any]]:
        return self._history.get(key, [])

    def record_tx(self, tx: Dict[str, Any]) -> None:
        self._transactions.append(tx)

    @property
    def transaction_count(self) -> int:
        return len(self._transactions)


# ─── Simulator ─────────────────────────────────────────────────────────────────

class BlockchainSimulator:
    """
    Local blockchain adapter.

    SIMULATION — NOT A REAL BLOCKCHAIN.

    Mimics Hyperledger Fabric chaincode calls without connecting to a real
    peer node.  All state is held in memory and is lost on restart unless
    persisted by the application layer (SQLite in this prototype).
    """

    STATUS = "SIMULATION - NOT A REAL BLOCKCHAIN"

    def __init__(self) -> None:
        self._ledger = LedgerState()
        self.status = self.STATUS

    # ── Chaincode: CreateVerificationRecord ────────────────────────────────────

    def create_verification_record(
        self,
        *,
        session_id: str,
        organization: str,
        challenge_nonce: str,
        verification_method: str,
        evidence_reference: Optional[str] = None,
        actor_role: str = "",
    ) -> Dict[str, Any]:
        key = f"verification:{session_id}"
        record = {
            "session_id": session_id,
            "organization": organization,
            "challenge_nonce": challenge_nonce,
            "verification_method": verification_method,
            "evidence_reference": evidence_reference,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._ledger.put(key, record)
        return self._emit_tx("CreateVerificationRecord", organization, actor_role, {"session_id": session_id})

    # ── Chaincode: CreateFraudCase ─────────────────────────────────────────────

    def create_fraud_case(
        self,
        *,
        case_id: str,
        organization: str,
        case_category: str,
        risk_level: str,
        evidence_commitment: str,
        access_policy: str,
        actor_role: str = "",
    ) -> Dict[str, Any]:
        key = f"case:{case_id}"
        record = {
            "case_id": case_id,
            "organization": organization,
            "case_category": case_category,
            "risk_level": risk_level,
            "evidence_commitment": evidence_commitment,
            "access_policy": access_policy,
            "status": "CREATED",
            "participants": [organization],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._ledger.put(key, record)
        return self._emit_tx("CreateFraudCase", organization, actor_role, {"case_id": case_id})

    # ── Generic event recorder (used by most lifecycle transitions) ────────────

    def record_event(
        self,
        event_type: str,
        *,
        organization: str,
        actor_role: str,
        details: Optional[Dict[str, Any]] = None,
        case_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        tx = self._emit_tx(event_type, organization, actor_role, details or {}, case_id=case_id)
        if case_id:
            # Update ledger state for known transition types
            key = f"case:{case_id}"
            state = self._ledger.get(key) or {}
            new_status = (details or {}).get("new_status")
            if new_status:
                state = {**state, "status": new_status, "updated_at": tx["timestamp"]}
                self._ledger.put(key, state)
        return tx

    # ── Chaincode: VerifyEvidenceCommitment ───────────────────────────────────

    def verify_evidence_commitment(self, evidence_text: str, expected_hash: str) -> Dict[str, Any]:
        actual_hash = hashlib.sha256(evidence_text.encode("utf-8")).hexdigest()
        matches = actual_hash == expected_hash
        return {
            "verified": matches,
            "expected_hash": expected_hash,
            "actual_hash": actual_hash,
            "message": (
                "Evidence matches the recorded commitment."
                if matches
                else "Evidence does not match the recorded commitment."
            ),
        }

    # ── Chaincode: GetCaseHistory ──────────────────────────────────────────────

    def get_case_history(self, case_id: str) -> List[Dict[str, Any]]:
        return self._ledger.get_history(f"case:{case_id}")

    # ── Chaincode: GetAuthorizedCaseSummary ───────────────────────────────────

    def get_authorized_case_summary(self, case_id: str, requesting_org: str) -> Optional[Dict[str, Any]]:
        state = self._ledger.get(f"case:{case_id}")
        if state is None:
            return None
        if requesting_org not in state.get("participants", []):
            return None  # Not authorized
        # Return minimum-necessary summary only
        return {
            "case_id": state["case_id"],
            "case_category": state.get("case_category"),
            "risk_level": state.get("risk_level"),
            "status": state.get("status"),
            "evidence_commitment": state.get("evidence_commitment"),
            "created_at": state.get("created_at"),
        }

    # ── Canonical event serialization ──────────────────────────────────────────

    def canonicalize_event(self, data: Dict[str, Any]) -> str:
        """Deterministic JSON serialization for hashing and audit commitments."""
        return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)

    # ── Blockchain status ─────────────────────────────────────────────────────

    @property
    def transaction_count(self) -> int:
        return self._ledger.transaction_count

    # ── Private helpers ───────────────────────────────────────────────────────

    def _emit_tx(
        self,
        function_name: str,
        organization: str,
        actor_role: str,
        details: Dict[str, Any],
        case_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        tx_id = f"sim-tx-{uuid.uuid4().hex}"
        tx = {
            "transaction_id": tx_id,
            "function": function_name,
            "event_type": function_name,
            "organization": organization,
            "actor_role": actor_role,
            "case_id": case_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": details,
            "status": "SIMULATED_LEDGER_OK",
            "ledger_mode": "SIMULATION - NOT A REAL BLOCKCHAIN",
            "evidence_commitment": details.get("evidence_commitment"),
        }
        self._ledger.record_tx(tx)
        return tx
