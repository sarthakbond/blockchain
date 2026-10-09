from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    code = Column(String, unique=True, nullable=False)
    description = Column(Text, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    users = relationship("User", back_populates="organization")
    cases = relationship("FraudCase", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    role = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="users")
    created_cases = relationship("FraudCase", back_populates="creator")
    case_events = relationship("CaseEvent", back_populates="actor")


class VerificationSession(Base):
    __tablename__ = "verification_sessions"

    id = Column(String, primary_key=True, index=True)
    session_identifier = Column(String, nullable=False)
    issuing_bank = Column(String, nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    verification_method = Column(String, nullable=False)
    consent_status = Column(String, nullable=False, default="AUTHORIZED")
    evidence_reference = Column(String, nullable=True)
    challenge_nonce = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String, nullable=False, default="CREATED")

    checks = relationship("VerificationCheck", back_populates="session")
    risk_assessment = relationship("RiskAssessment", back_populates="session", uselist=False)


class VerificationCheck(Base):
    __tablename__ = "verification_checks"

    id = Column(String, primary_key=True, index=True)
    verification_session_id = Column(String, ForeignKey("verification_sessions.id"), nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, nullable=False)
    risk_score = Column(String, nullable=True)
    model_id = Column(String, nullable=True)
    model_version = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    explanation = Column(Text, default="")
    evidence_reference = Column(String, nullable=True)
    reason_codes = Column(JSON, default=list)

    session = relationship("VerificationSession", back_populates="checks")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(String, primary_key=True, index=True)
    verification_session_id = Column(String, ForeignKey("verification_sessions.id"), nullable=False)
    overall_risk = Column(String, nullable=False)
    rule_ids = Column(JSON, default=list)
    explanation = Column(Text, default="")
    recommendation = Column(String, nullable=True)
    missing_checks = Column(JSON, default=list)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("VerificationSession", back_populates="risk_assessment")


class FraudCase(Base):
    __tablename__ = "fraud_cases"

    id = Column(String, primary_key=True, index=True)
    case_category = Column(String, nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    risk_level = Column(String, nullable=False)
    summary = Column(Text, default="")
    reason_codes = Column(JSON, default=list)
    evidence_commitment = Column(String, nullable=True)
    access_policy = Column(String, default="BANK_MINIMUM_NEED_TO_KNOW")
    status = Column(String, nullable=False, default="CREATED")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    verification_session_id = Column(String, ForeignKey("verification_sessions.id"), nullable=True)

    organization = relationship("Organization", back_populates="cases")
    creator = relationship("User", back_populates="created_cases")
    participants = relationship("CaseParticipant", back_populates="case")
    events = relationship("CaseEvent", back_populates="case")


class CaseParticipant(Base):
    __tablename__ = "case_participants"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("fraud_cases.id"), nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    role = Column(String, nullable=False)
    can_view = Column(Boolean, default=True)
    can_edit = Column(Boolean, default=False)

    case = relationship("FraudCase", back_populates="participants")


class CaseEvent(Base):
    __tablename__ = "case_events"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("fraud_cases.id"), nullable=False)
    event_type = Column(String, nullable=False)
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    actor_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, nullable=False)
    reason = Column(Text, default="")
    transaction_ref = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    payload = Column(JSON, default=dict)

    actor = relationship("User", back_populates="case_events")
    case = relationship("FraudCase", back_populates="events")


class EvidenceMetadata(Base):
    __tablename__ = "evidence_metadata"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("fraud_cases.id"), nullable=False)
    file_name = Column(String, nullable=False)
    storage_path = Column(String, nullable=True)
    sha256 = Column(String, nullable=False)
    canonical_payload = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, index=True)
    case_id = Column(String, ForeignKey("fraud_cases.id"), nullable=True)
    event_type = Column(String, nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    actor_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    transaction_id = Column(String, nullable=True)
    details = Column(JSON, default=dict)
    evidence_commitment = Column(String, nullable=True)
    verification_result = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class BlockchainTransaction(Base):
    __tablename__ = "blockchain_transactions"

    id = Column(String, primary_key=True, index=True)
    tx_id = Column(String, unique=True, nullable=False)
    event_type = Column(String, nullable=False)
    organization_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    case_id = Column(String, ForeignKey("fraud_cases.id"), nullable=True)
    ledger_status = Column(String, nullable=False)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
