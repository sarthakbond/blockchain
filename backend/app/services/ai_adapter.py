from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class DetectorResult:
    name: str
    status: str
    risk_score: Optional[float] = None
    model_id: str = "simulated-detector"
    model_version: str = "v0.1"
    reason_codes: List[str] = field(default_factory=list)
    explanation: str = ""
    evidence_reference: Optional[str] = None
    timestamp: Optional[str] = None

    def to_payload(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "risk_score": self.risk_score,
            "model_id": self.model_id,
            "model_version": self.model_version,
            "reason_codes": self.reason_codes,
            "explanation": self.explanation,
            "evidence_reference": self.evidence_reference,
            "timestamp": self.timestamp or datetime.now(timezone.utc).isoformat(),
        }


def build_simulated_ai_results() -> List[Dict[str, Any]]:
    return [
        DetectorResult(
            name="deepfake_liveness",
            status="FAIL",
            risk_score=0.91,
            model_id="fusion-deepfake-v1",
            model_version="1.0.0",
            reason_codes=["FACE_MANIPULATION_HIGH", "LIVENESS_FAILURE"],
            explanation="Simulated detector flagged face synthesis and liveness mismatch.",
            evidence_reference="evidence://alpha/deepfake-session-001",
        ).to_payload(),
        DetectorResult(
            name="voice_spoofing",
            status="REVIEW",
            risk_score=0.72,
            model_id="fusion-voice-v1",
            model_version="1.0.0",
            reason_codes=["VOICE_CLONING_SUSPECTED"],
            explanation="Synthetic voice pattern detected. Human review recommended.",
            evidence_reference="evidence://alpha/voice-recording-001",
        ).to_payload(),
        DetectorResult(
            name="document_tampering",
            status="FAIL",
            risk_score=0.84,
            model_id="fusion-doc-v1",
            model_version="1.0.0",
            reason_codes=["DOCUMENT_INCONSISTENT", "FACE_DOC_COMPARISON_FAILED"],
            explanation="Document metadata and facial reference do not align.",
            evidence_reference="evidence://alpha/docscan-001",
        ).to_payload(),
        DetectorResult(
            name="presentation_attack",
            status="PASS",
            risk_score=0.14,
            model_id="fusion-presentation-v1",
            model_version="1.0.0",
            reason_codes=["NO_REPLAY_INDICATED"],
            explanation="Replay detection has no suspicious patterns.",
            evidence_reference=None,
        ).to_payload(),
    ]


def parse_detector_results(raw_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for item in raw_results:
        normalized.append(
            {
                "name": item.get("name", "unknown_detector"),
                "status": item.get("status", "UNAVAILABLE").upper(),
                "risk_score": item.get("risk_score"),
                "model_id": item.get("model_id", "simulated-detector"),
                "model_version": item.get("model_version", "v0.1"),
                "reason_codes": item.get("reason_codes", []),
                "explanation": item.get("explanation", ""),
                "evidence_reference": item.get("evidence_reference"),
                "timestamp": item.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            }
        )
    return normalized
