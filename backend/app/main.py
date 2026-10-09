from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, get_db
from .models import (
    AuditEvent,
    BlockchainTransaction,
    CaseEvent,
    CaseParticipant,
    EvidenceMetadata,
    FraudCase,
    Organization,
    RiskAssessment,
    User,
    VerificationCheck,
    VerificationSession,
)
from .schemas import (
    BlockchainStatus,
    CaseEventCreate,
    CaseHistoryEntry,
    EvidenceCommitmentRequest,
    EvidenceVerificationRequest,
    FraudCaseCreate,
    LoginRequest,
    LoginResponse,
    OrganizationRead,
    ShareCaseRequest,
    UserRead,
    VerificationResultCreate,
    VerificationSessionCreate,
)
from .security import generate_demo_token, hash_password, verify_password
from .services.blockchain_simulator import BlockchainSimulator
from .services.risk_engine import calculate_risk

app = FastAPI(title="FUSION Platform", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.simulator = BlockchainSimulator()
app.state.demo_tokens: Dict[str, str] = {}

VALID_TRANSITIONS = {
    "CREATED": {"SHARED", "CLOSED_WITHOUT_FINDING"},
    "SHARED": {"ACKNOWLEDGED", "UNDER_REVIEW", "DISPUTED", "ESCALATED", "CLOSED_WITHOUT_FINDING"},
    "ACKNOWLEDGED": {"UNDER_REVIEW", "NEEDS_MORE_INFORMATION", "DISPUTED", "ESCALATED"},
    "NEEDS_MORE_INFORMATION": {"UNDER_REVIEW", "DISPUTED", "ESCALATED"},
    "UNDER_REVIEW": {"RESOLVED", "DISPUTED", "ESCALATED", "NEEDS_MORE_INFORMATION"},
    "DISPUTED": {"UNDER_REVIEW", "ESCALATED", "RESOLVED"},
    "ESCALATED": {"UNDER_REVIEW", "RESOLVED", "DISPUTED"},
    "RESOLVED": {"CLOSED_WITHOUT_FINDING"},
    "CLOSED_WITHOUT_FINDING": set(),
}


def create_demo_data(db: Session) -> None:
    orgs = [
        {"id": "org-alpha", "name": "Bank Alpha", "code": "ALPHA", "description": "Core KYC originator."},
        {"id": "org-beta", "name": "Bank Beta", "code": "BETA", "description": "Cross-bank fraud investigator."},
        {"id": "org-gamma", "name": "Bank Gamma", "code": "GAMMA", "description": "Independent audit bank."},
    ]
    for org in orgs:
        if not db.query(Organization).filter(Organization.id == org["id"]).first():
            db.add(Organization(**org))

    users = {
        "alpha.officer": {"id": "user-alpha-officer", "organization_id": "org-alpha", "role": "BANK_KYC_OFFICER", "display_name": "Maya Stone", "email": "maya.stone@alpha.demo"},
        "alpha.admin": {"id": "user-alpha-admin", "organization_id": "org-alpha", "role": "BANK_ADMINISTRATOR", "display_name": "Alicia Lee", "email": "alicia.lee@alpha.demo"},
        "beta.investigator": {"id": "user-beta-investigator", "organization_id": "org-beta", "role": "BANK_FRAUD_INVESTIGATOR", "display_name": "Daniel Cruz", "email": "daniel.cruz@beta.demo"},
        "beta.auditor": {"id": "user-beta-auditor", "organization_id": "org-beta", "role": "NETWORK_AUDITOR", "display_name": "Priya Nair", "email": "priya.nair@beta.demo"},
        "gamma.auditor": {"id": "user-gamma-auditor", "organization_id": "org-gamma", "role": "NETWORK_AUDITOR", "display_name": "Ethan Park", "email": "ethan.park@gamma.demo"},
    }
    for username, data in users.items():
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            existing.email = data["email"]
            existing.organization_id = data["organization_id"]
            existing.role = data["role"]
            existing.display_name = data["display_name"]
            existing.password_hash = hash_password(username + "!123!")
        else:
            db.add(
                User(
                    id=data["id"],
                    username=username,
                    email=data["email"],
                    password_hash=hash_password(username + "!123!"),
                    organization_id=data["organization_id"],
                    role=data["role"],
                    display_name=data["display_name"],
                )
            )
    db.commit()

    if not db.query(VerificationSession).count():
        alpha_org = db.query(Organization).filter(Organization.code == "ALPHA").one()
        alpha_user = db.query(User).filter(User.username == "alpha.officer").one()
        session = VerificationSession(
            id="verif-demo-01",
            session_identifier="session-alpha-001",
            issuing_bank="Bank Alpha",
            organization_id=alpha_org.id,
            created_by_user_id=alpha_user.id,
            verification_method="VIDEO_LIVENESS",
            evidence_reference="evidence://alpha/docscan-001",
            challenge_nonce="nonce-demo-001",
            consent_status="AUTHORIZED",
            status="CREATED",
        )
        db.add(session)
        db.commit()

        db.add_all(
            [
                VerificationCheck(
                    id="check-demo-df",
                    verification_session_id=session.id,
                    name="deepfake_liveness",
                    status="FAIL",
                    risk_score="0.91",
                    model_id="fusion-deepfake-v1",
                    model_version="1.0.0",
                    explanation="Face synthesis detected.",
                    evidence_reference="evidence://alpha/deepfake-session-001",
                    reason_codes=["FACE_MANIPULATION_HIGH", "LIVENESS_FAILURE"],
                ),
                VerificationCheck(
                    id="check-demo-doc",
                    verification_session_id=session.id,
                    name="document_tampering",
                    status="FAIL",
                    risk_score="0.84",
                    model_id="fusion-doc-v1",
                    model_version="1.0.0",
                    explanation="Documentation mismatch with face capture.",
                    evidence_reference="evidence://alpha/docscan-001",
                    reason_codes=["DOCUMENT_INCONSISTENT", "FACE_DOC_COMPARISON_FAILED"],
                ),
                VerificationCheck(
                    id="check-demo-voice",
                    verification_session_id=session.id,
                    name="voice_spoofing",
                    status="REVIEW",
                    risk_score="0.72",
                    model_id="fusion-voice-v1",
                    model_version="1.0.0",
                    explanation="Voice clone pattern noted.",
                    evidence_reference="evidence://alpha/voice-recording-001",
                    reason_codes=["VOICE_CLONING_SUSPECTED"],
                ),
            ]
        )
        risk = calculate_risk(
            [
                {"name": "deepfake_liveness", "status": "FAIL"},
                {"name": "document_tampering", "status": "FAIL"},
                {"name": "voice_spoofing", "status": "REVIEW"},
            ]
        )
        db.add(
            RiskAssessment(
                id="risk-demo-01",
                verification_session_id=session.id,
                overall_risk=risk["overall_risk"],
                rule_ids=risk["rule_ids"],
                explanation=risk["explanation"],
                recommendation=risk["recommendation"],
                missing_checks=risk.get("missing_checks", []),
            )
        )
        db.commit()

    if not db.query(FraudCase).count():
        alpha_user = db.query(User).filter(User.username == "alpha.officer").one()
        case = FraudCase(
            id="case-demo-01",
            case_category="DEEPFAKE_FACE",
            organization_id="org-alpha",
            created_by_user_id=alpha_user.id,
            risk_level="HIGH",
            summary="Face manipulation and document mismatch in a KYC check.",
            reason_codes=["DOCUMENT_INCONSISTENT", "LIVENESS_FAILURE"],
            evidence_commitment="abc123",
            access_policy="BANK_MINIMUM_NEED_TO_KNOW",
            status="SHARED",
            verification_session_id="verif-demo-01",
        )
        db.add(case)
        db.commit()

        db.add_all(
            [
                CaseParticipant(
                    id="participant-demo-01",
                    case_id=case.id,
                    organization_id="org-alpha",
                    role="BANK_KYC_OFFICER",
                    can_view=True,
                    can_edit=True,
                ),
                CaseParticipant(
                    id="participant-demo-02",
                    case_id=case.id,
                    organization_id="org-beta",
                    role="BANK_FRAUD_INVESTIGATOR",
                    can_view=True,
                    can_edit=False,
                ),
                CaseEvent(
                    id="event-demo-01",
                    case_id=case.id,
                    event_type="CREATED",
                    previous_status=None,
                    new_status="CREATED",
                    organization_id="org-alpha",
                    actor_user_id=alpha_user.id,
                    role="BANK_KYC_OFFICER",
                    reason="Initial verification flagged deepfake risk.",
                    transaction_ref="sim-tx-0001",
                    payload={"seed": "demo"},
                ),
                CaseEvent(
                    id="event-demo-02",
                    case_id=case.id,
                    event_type="SHARED",
                    previous_status="CREATED",
                    new_status="SHARED",
                    organization_id="org-alpha",
                    actor_user_id=alpha_user.id,
                    role="BANK_KYC_OFFICER",
                    reason="Shared the minimum-necessary alert with Bank Beta.",
                    transaction_ref="sim-tx-0002",
                    payload={"recipient": "org-beta"},
                ),
            ]
        )
        db.add(
            AuditEvent(
                id="audit-demo-01",
                case_id=case.id,
                event_type="SHARED",
                organization_id="org-alpha",
                actor_user_id=alpha_user.id,
                transaction_id="sim-tx-0002",
                details={"recipient": "org-beta", "reason": "minimum necessary alert"},
                evidence_commitment=case.evidence_commitment,
                verification_result=case.risk_level,
            )
        )
        db.commit()


def ensure_database() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        create_demo_data(db)


@app.on_event("startup")
def startup_event() -> None:
    ensure_database()


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    authorization = request.headers.get("authorization") or ""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1].strip()
    user_id = app.state.demo_tokens.get(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not active")
    return user


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    ensure_database()
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = generate_demo_token()
    app.state.demo_tokens[token] = user.id
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead(
            id=user.id,
            username=user.username,
            email=user.email,
            organization_id=user.organization_id,
            role=user.role,
            display_name=user.display_name,
        ),
    )


@app.get("/api/v1/auth/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        organization_id=current_user.organization_id,
        role=current_user.role,
        display_name=current_user.display_name,
    )


@app.get("/api/v1/organizations", response_model=list[OrganizationRead])
def list_organizations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> List[OrganizationRead]:
    _ = current_user
    return [
        OrganizationRead(
            id=org.id,
            name=org.name,
            code=org.code,
            description=org.description,
            is_active=org.is_active,
        )
        for org in db.query(Organization).all()
    ]


@app.get("/api/v1/system/status")
def system_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    return {
        "system": "FUSION",
        "database": "sqlite",
        "database_health": "ok",
        "organization_count": db.query(Organization).count(),
        "verification_session_count": db.query(VerificationSession).count(),
        "case_count": db.query(FraudCase).count(),
        "blockchain": {
            "status": app.state.simulator.status,
            "mode": "SIMULATED",
            "ledger_ready": True,
            "transaction_count": db.query(BlockchainTransaction).count(),
        },
        "ai_detector_status": "SIMULATED_DETECTORS_ACTIVE",
        "evidence_storage_status": "LOCAL_ENCRYPTED_STORAGE_SIMULATION",
        "user_organization": current_user.organization_id,
    }


@app.post("/api/v1/verifications", response_model=Dict[str, Any])
def create_verification(payload: VerificationSessionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    session = VerificationSession(
        id=str(uuid.uuid4()),
        session_identifier=payload.session_identifier,
        issuing_bank=payload.issuing_bank,
        organization_id=current_user.organization_id,
        created_by_user_id=current_user.id,
        verification_method=payload.verification_method,
        consent_status=payload.consent_status,
        evidence_reference=payload.evidence_reference,
        challenge_nonce=str(uuid.uuid4()),
        status="CREATED",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "session_identifier": session.session_identifier, "status": session.status}


@app.get("/api/v1/verifications/{verification_id}")
def get_verification(verification_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    session = db.query(VerificationSession).filter(VerificationSession.id == verification_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Verification not found")
    if session.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not permitted to access this session")
    checks = [
        {
            "id": check.id,
            "name": check.name,
            "status": check.status,
            "risk_score": check.risk_score,
            "model_id": check.model_id,
            "model_version": check.model_version,
            "timestamp": check.timestamp.isoformat() if check.timestamp else None,
            "explanation": check.explanation,
            "evidence_reference": check.evidence_reference,
            "reason_codes": check.reason_codes,
        }
        for check in session.checks
    ]
    return {"id": session.id, "session_identifier": session.session_identifier, "checks": checks, "status": session.status}


@app.post("/api/v1/verifications/{verification_id}/results")
def submit_verification_results(verification_id: str, payload: VerificationResultCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    session = db.query(VerificationSession).filter(VerificationSession.id == verification_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Verification not found")
    if session.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not permitted to submit results")
    for item in payload.results:
        db.add(
            VerificationCheck(
                id=str(uuid.uuid4()),
                verification_session_id=session.id,
                name=item.name,
                status=item.status.upper(),
                risk_score=str(item.risk_score) if item.risk_score is not None else None,
                model_id=item.model_id,
                model_version=item.model_version,
                explanation=item.explanation,
                evidence_reference=item.evidence_reference,
                reason_codes=item.reason_codes,
                timestamp=item.timestamp or datetime.now(timezone.utc),
            )
        )
    session.status = "RESULTS_SUBMITTED"
    db.commit()
    return {"verification_id": session.id, "saved_results": len(payload.results)}


@app.post("/api/v1/verifications/{verification_id}/calculate-risk")
def calculate_verification_risk(verification_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    session = db.query(VerificationSession).filter(VerificationSession.id == verification_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Verification not found")
    if session.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not permitted to calculate risk")
    checks = [
        {
            "name": check.name,
            "status": check.status,
            "risk_score": float(check.risk_score) if check.risk_score is not None else None,
            "model_id": check.model_id,
            "model_version": check.model_version,
            "reason_codes": check.reason_codes,
            "explanation": check.explanation,
            "evidence_reference": check.evidence_reference,
        }
        for check in session.checks
    ]
    result = calculate_risk(checks)
    assessment = RiskAssessment(
        id=str(uuid.uuid4()),
        verification_session_id=session.id,
        overall_risk=result["overall_risk"],
        rule_ids=result["rule_ids"],
        explanation=result["explanation"],
        recommendation=result["recommendation"],
        missing_checks=result.get("missing_checks", []),
    )
    db.add(assessment)
    db.commit()
    return {
        "verification_id": session.id,
        "overall_risk": result["overall_risk"],
        "rule_ids": result["rule_ids"],
        "recommendation": result["recommendation"],
        "missing_checks": result.get("missing_checks", []),
        "explanation": result["explanation"],
    }


def case_has_permission(db: Session, case_id: str, org_id: str) -> bool:
    participant = db.query(CaseParticipant).filter(and_(CaseParticipant.case_id == case_id, CaseParticipant.organization_id == org_id, CaseParticipant.can_view.is_(True))).first()
    return participant is not None


def append_case_event(db: Session, case: FraudCase, actor: User, event_type: str, reason: str, new_status: Optional[str], payload: Optional[Dict[str, Any]] = None) -> CaseEvent:
    if new_status:
        if case.status == new_status:
            pass
        else:
            allowed = VALID_TRANSITIONS.get(case.status, set())
            if case.status and new_status not in allowed:
                raise HTTPException(status_code=400, detail=f"Invalid transition from {case.status} to {new_status}")
    previous_status = case.status
    transaction = app.state.simulator.record_event(
        event_type,
        organization=actor.organization_id,
        actor_role=actor.role,
        details={
            "reason": reason,
            "previous_status": previous_status,
            "new_status": new_status,
            "payload": payload or {},
            "evidence_commitment": case.evidence_commitment,
        },
        case_id=case.id,
    )
    db.add(
        BlockchainTransaction(
            id=str(uuid.uuid4()),
            tx_id=transaction["transaction_id"],
            event_type=event_type,
            organization_id=actor.organization_id,
            case_id=case.id,
            ledger_status=transaction["status"],
            details=transaction,
        )
    )
    event = CaseEvent(
        id=str(uuid.uuid4()),
        case_id=case.id,
        event_type=event_type,
        previous_status=case.status,
        new_status=new_status,
        organization_id=actor.organization_id,
        actor_user_id=actor.id,
        role=actor.role,
        reason=reason,
        transaction_ref=transaction["transaction_id"],
        payload=payload or {},
    )
    db.add(event)
    if new_status:
        case.status = new_status
    case.updated_at = datetime.now(timezone.utc)
    db.add(
        AuditEvent(
            id=str(uuid.uuid4()),
            case_id=case.id,
            event_type=event_type,
            organization_id=actor.organization_id,
            actor_user_id=actor.id,
            transaction_id=transaction["transaction_id"],
            details={"reason": reason, "previous_status": event.previous_status, "new_status": new_status},
            evidence_commitment=case.evidence_commitment,
            verification_result=case.risk_level,
        )
    )
    return event


@app.post("/api/v1/cases", response_model=Dict[str, Any])
def create_case(payload: FraudCaseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = FraudCase(
        id=str(uuid.uuid4()),
        case_category=payload.case_category,
        organization_id=current_user.organization_id,
        created_by_user_id=current_user.id,
        risk_level=payload.risk_level,
        summary=payload.summary,
        reason_codes=payload.reason_codes,
        evidence_commitment=payload.evidence_commitment,
        access_policy=payload.access_policy,
        status="CREATED",
        verification_session_id=payload.verification_session_id,
    )
    db.add(case)
    db.flush()
    db.add(CaseParticipant(id=str(uuid.uuid4()), case_id=case.id, organization_id=current_user.organization_id, role=current_user.role, can_view=True, can_edit=True))
    append_case_event(db, case, current_user, "CREATED", "Case created by authorized officer.", "CREATED")
    db.commit()
    return {"id": case.id, "status": case.status, "case_category": case.case_category}


@app.get("/api/v1/cases")
def list_cases(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> List[Dict[str, Any]]:
    case_ids = [row[0] for row in db.query(CaseParticipant.case_id).filter(and_(CaseParticipant.organization_id == current_user.organization_id, CaseParticipant.can_view.is_(True))).all()]
    cases = db.query(FraudCase).filter(or_(FraudCase.organization_id == current_user.organization_id, FraudCase.id.in_(case_ids))).all()
    return [{
        "id": case.id,
        "case_category": case.case_category,
        "risk_level": case.risk_level,
        "status": case.status,
        "summary": case.summary,
        "organization_id": case.organization_id,
        "originating_organization_name": case.organization.name,
        "participants": [participant.organization_id for participant in case.participants if participant.can_view],
        "created_at": case.created_at.isoformat(),
    } for case in cases]


@app.get("/api/v1/cases/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id and not case_has_permission(db, case.id, current_user.organization_id):
        raise HTTPException(status_code=403, detail="Not permitted to view this case")
    return {
        "id": case.id,
        "case_category": case.case_category,
        "risk_level": case.risk_level,
        "status": case.status,
        "summary": case.summary,
        "reason_codes": case.reason_codes,
        "organization_id": case.organization_id,
        "originating_organization_name": case.organization.name,
        "access_policy": case.access_policy,
        "participants": [participant.organization_id for participant in case.participants],
        "evidence_commitment": case.evidence_commitment,
    }


@app.post("/api/v1/cases/{case_id}/share")
def share_case(case_id: str, payload: ShareCaseRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Only the originating bank may share a case")
    if payload.organization_id == case.organization_id:
        raise HTTPException(status_code=400, detail="A case cannot be shared with its originating bank")
    recipient = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_active.is_(True)).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient organization not found")
    if db.query(CaseParticipant).filter(and_(CaseParticipant.case_id == case_id, CaseParticipant.organization_id == payload.organization_id)).first():
        raise HTTPException(status_code=409, detail="Case is already shared with this organization")
    db.add(CaseParticipant(id=str(uuid.uuid4()), case_id=case.id, organization_id=payload.organization_id, role=payload.role, can_view=True, can_edit=False))
    append_case_event(db, case, current_user, "SHARED", "Shared minimum necessary alert", "SHARED", {"recipient": payload.organization_id, "role": payload.role})
    db.commit()
    return {"case_id": case.id, "shared_with": payload.organization_id, "status": case.status}


@app.post("/api/v1/cases/{case_id}/acknowledge")
def acknowledge_case(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id and not case_has_permission(db, case.id, current_user.organization_id):
        raise HTTPException(status_code=403, detail="Not authorized to acknowledge this case")
    append_case_event(db, case, current_user, "ACKNOWLEDGED", "Recipient acknowledged the case.", "ACKNOWLEDGED")
    db.commit()
    return {"case_id": case.id, "status": case.status}


@app.post("/api/v1/cases/{case_id}/findings")
def submit_review_finding(case_id: str, payload: CaseEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id and not case_has_permission(db, case.id, current_user.organization_id):
        raise HTTPException(status_code=403, detail="Not permitted to add findings")
    append_case_event(db, case, current_user, "REVIEW_FINDING", payload.reason or "Review finding submitted.", payload.new_status or "UNDER_REVIEW", payload.payload)
    db.commit()
    return {"case_id": case.id, "status": case.status}


@app.post("/api/v1/cases/{case_id}/request-information")
def request_information(case_id: str, payload: CaseEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id and not case_has_permission(db, case.id, current_user.organization_id):
        raise HTTPException(status_code=403, detail="Not permitted to request information")
    append_case_event(db, case, current_user, "REQUEST_INFORMATION", payload.reason or "Additional information requested.", "NEEDS_MORE_INFORMATION", payload.payload)
    db.commit()
    return {"case_id": case.id, "status": case.status}


@app.post("/api/v1/cases/{case_id}/dispute")
def dispute_case(case_id: str, payload: CaseEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id and not case_has_permission(db, case.id, current_user.organization_id):
        raise HTTPException(status_code=403, detail="Not permitted to dispute this case")
    append_case_event(db, case, current_user, "DISPUTED", payload.reason or "Case disputed.", "DISPUTED", payload.payload)
    db.commit()
    return {"case_id": case.id, "status": case.status}


@app.post("/api/v1/cases/{case_id}/escalate")
def escalate_case(case_id: str, payload: CaseEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id and not case_has_permission(db, case.id, current_user.organization_id):
        raise HTTPException(status_code=403, detail="Not permitted to escalate this case")
    append_case_event(db, case, current_user, "ESCALATED", payload.reason or "Case escalated for review.", "ESCALATED", payload.payload)
    db.commit()
    return {"case_id": case.id, "status": case.status}


@app.post("/api/v1/cases/{case_id}/resolve")
def resolve_case(case_id: str, payload: CaseEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id and current_user.role not in {"NETWORK_AUDITOR", "BANK_ADMINISTRATOR"}:
        raise HTTPException(status_code=403, detail="Not permitted to resolve this case")
    append_case_event(db, case, current_user, "RESOLVED", payload.reason or "Case resolved.", "RESOLVED", payload.payload)
    db.commit()
    return {"case_id": case.id, "status": case.status}


@app.post("/api/v1/cases/{case_id}/correct")
def correct_case(case_id: str, payload: CaseEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Only the originating bank may correct a case")
    append_case_event(db, case, current_user, "CORRECTION", payload.reason or "Corrective event appended.", case.status, {"correction": payload.payload, "append_only": True})
    db.commit()
    return {"case_id": case.id, "status": case.status, "event_type": "CORRECTION"}


@app.get("/api/v1/cases/{case_id}/history")
def get_case_history(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> List[CaseHistoryEntry]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id and not case_has_permission(db, case.id, current_user.organization_id):
        raise HTTPException(status_code=403, detail="Not permitted to view case history")
    events = db.query(CaseEvent).filter(CaseEvent.case_id == case_id).order_by(CaseEvent.timestamp.asc()).all()
    return [
        CaseHistoryEntry(
            id=event.id,
            event_type=event.event_type,
            previous_status=event.previous_status,
            new_status=event.new_status,
            organization_id=event.organization_id,
            role=event.role,
            reason=event.reason,
            transaction_ref=event.transaction_ref,
            timestamp=event.timestamp,
        )
        for event in events
    ]


@app.get("/api/v1/cases/{case_id}/audit")
def get_case_audit(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> List[Dict[str, Any]]:
    case = db.query(FraudCase).filter(FraudCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.organization_id != current_user.organization_id and not case_has_permission(db, case.id, current_user.organization_id):
        raise HTTPException(status_code=403, detail="Not permitted to view case audit")
    events = db.query(AuditEvent).filter(AuditEvent.case_id == case_id).order_by(AuditEvent.created_at.asc()).all()
    return [{
        "id": event.id,
        "event_type": event.event_type,
        "organization_id": event.organization_id,
        "actor_user_id": event.actor_user_id,
        "transaction_id": event.transaction_id,
        "details": event.details,
        "evidence_commitment": event.evidence_commitment,
        "verification_result": event.verification_result,
        "created_at": event.created_at.isoformat(),
    } for event in events]


@app.post("/api/v1/evidence/commitment")
def save_evidence_commitment(payload: EvidenceCommitmentRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    _ = current_user
    canonical = payload.canonical_payload or payload.content
    commitment = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    evidence = EvidenceMetadata(
        id=str(uuid.uuid4()),
        case_id=payload.case_id or "",
        file_name=payload.file_name,
        storage_path=f"local://{payload.file_name}",
        sha256=commitment,
        canonical_payload=canonical,
    )
    db.add(evidence)
    db.commit()
    return {"id": evidence.id, "sha256": commitment, "status": "COMMITTED"}


@app.post("/api/v1/evidence/verify")
def verify_evidence(payload: EvidenceVerificationRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    _ = db, current_user
    return app.state.simulator.verify_evidence_commitment(payload.evidence_text, payload.expected_hash)


@app.get("/api/v1/blockchain/status")
def blockchain_status(db: Session = Depends(get_db)) -> BlockchainStatus:
    return BlockchainStatus(
        status=app.state.simulator.status,
        transaction_count=db.query(BlockchainTransaction).count(),
        ledger_ready=True,
        mode="SIMULATED",
    )


@app.get("/api/v1/demo-config")
def demo_config() -> Dict[str, Any]:
    return {
        "demo_banks": [
            {"name": "Bank Alpha", "code": "ALPHA", "roles": ["BANK_KYC_OFFICER", "BANK_ADMINISTRATOR"]},
            {"name": "Bank Beta", "code": "BETA", "roles": ["BANK_FRAUD_INVESTIGATOR", "NETWORK_AUDITOR"]},
            {"name": "Bank Gamma", "code": "GAMMA", "roles": ["NETWORK_AUDITOR"]},
        ],
        "login_hint": "Use seeded demo accounts such as alpha.officer / alpha.officer!123! or beta.investigator / beta.investigator!123!",
    }
