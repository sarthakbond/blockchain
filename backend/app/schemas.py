from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class OrganizationRead(BaseModel):
    id: str
    name: str
    code: str
    description: str
    is_active: bool


class UserRead(BaseModel):
    id: str
    username: str
    email: str
    organization_id: str
    role: str
    display_name: str


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class VerificationSessionCreate(BaseModel):
    session_identifier: str
    issuing_bank: str
    verification_method: str = "VIDEO_LIVENESS"
    evidence_reference: Optional[str] = None
    consent_status: str = "AUTHORIZED"


class VerificationCheckInput(BaseModel):
    name: str
    status: str
    risk_score: Optional[float] = None
    model_id: Optional[str] = None
    model_version: Optional[str] = None
    explanation: str = ""
    evidence_reference: Optional[str] = None
    reason_codes: List[str] = Field(default_factory=list)
    timestamp: Optional[datetime] = None


class VerificationResultCreate(BaseModel):
    results: List[VerificationCheckInput]


class RiskAssessmentOut(BaseModel):
    id: str
    verification_session_id: str
    overall_risk: str
    rule_ids: List[str]
    explanation: str
    recommendation: str
    missing_checks: List[str]
    generated_at: datetime


class FraudCaseCreate(BaseModel):
    case_category: str
    risk_level: str
    summary: str
    reason_codes: List[str] = Field(default_factory=list)
    evidence_commitment: Optional[str] = None
    access_policy: str = "BANK_MINIMUM_NEED_TO_KNOW"
    verification_session_id: Optional[str] = None


class ShareCaseRequest(BaseModel):
    organization_id: str
    role: str = "FRAUD_INVESTIGATOR"


class CaseEventCreate(BaseModel):
    event_type: str = ""
    reason: str = ""
    new_status: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)


class CaseHistoryEntry(BaseModel):
    id: str
    event_type: str
    previous_status: Optional[str]
    new_status: Optional[str]
    organization_id: str
    role: str
    reason: str
    transaction_ref: Optional[str]
    timestamp: datetime


class EvidenceCommitmentRequest(BaseModel):
    file_name: str
    content: str
    canonical_payload: Optional[str] = None
    case_id: Optional[str] = None


class EvidenceVerificationRequest(BaseModel):
    evidence_text: str
    expected_hash: str


class BlockchainStatus(BaseModel):
    status: str
    transaction_count: int
    ledger_ready: bool
    mode: str = "SIMULATED"
