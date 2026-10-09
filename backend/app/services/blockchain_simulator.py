from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class BlockchainSimulator:
    def __init__(self) -> None:
        self.transactions: List[Dict[str, Any]] = []
        self.case_events: Dict[str, List[Dict[str, Any]]] = {}
        self.status = "SIMULATION - NOT A REAL BLOCKCHAIN"

    def record_event(self, event_type: str, *, organization: str, actor_role: str, details: Optional[Dict[str, Any]] = None, case_id: Optional[str] = None) -> Dict[str, Any]:
        tx_id = f"sim-tx-{uuid.uuid4().hex}"
        payload = {
            "transaction_id": tx_id,
            "event_type": event_type,
            "organization": organization,
            "actor_role": actor_role,
            "case_id": case_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": details or {},
            "status": "SIMULATED_LEDGER_OK",
            "evidence_commitment": details.get("evidence_commitment") if details else None,
        }
        self.transactions.append(payload)
        if case_id:
            self.case_events.setdefault(case_id, []).append(payload)
        return payload

    def verify_evidence_commitment(self, evidence_text: str, expected_hash: str) -> Dict[str, Any]:
        actual_hash = hashlib.sha256(evidence_text.encode("utf-8")).hexdigest()
        matches = actual_hash == expected_hash
        return {
            "verified": matches,
            "expected_hash": expected_hash,
            "actual_hash": actual_hash,
            "message": "Evidence matches the recorded commitment." if matches else "Evidence does not match the recorded commitment.",
        }

    def canonicalize_event(self, data: Dict[str, Any]) -> str:
        return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
