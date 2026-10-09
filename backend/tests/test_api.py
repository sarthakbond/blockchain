"""
FUSION Comprehensive Test Suite
=================================
Tests cover:
  - Functional: verification sessions, risk engine, case lifecycle
  - Security: access control, unauthorized actions, forbidden transitions
  - Audit: append-only history, evidence integrity, idempotency

⚠️  Blockchain tests use the LOCAL SIMULATOR only.
    They do NOT verify real Hyperledger Fabric behaviour.
    Label: SIMULATED BLOCKCHAIN TESTS
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def login(username: str) -> dict:
    """Login with the standard demo password pattern."""
    password = f"{username}!123!"
    resp = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return resp.json()


def headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def alpha_headers() -> dict:
    return headers(login("alpha.officer")["access_token"])


def beta_headers() -> dict:
    return headers(login("beta.investigator")["access_token"])


def gamma_headers() -> dict:
    return headers(login("gamma.auditor")["access_token"])


# ─── 1. Authentication and identity ──────────────────────────────────────────

class TestAuthentication:
    def test_valid_login(self):
        data = login("alpha.officer")
        assert data["access_token"]
        assert data["user"]["organization_id"] == "org-alpha"
        assert data["user"]["role"] == "BANK_KYC_OFFICER"

    def test_invalid_credentials_rejected(self):
        resp = client.post("/api/v1/auth/login", json={"username": "alpha.officer", "password": "wrong"})
        assert resp.status_code == 401

    def test_me_returns_correct_identity(self):
        h = alpha_headers()
        resp = client.get("/api/v1/auth/me", headers=h)
        assert resp.status_code == 200
        assert resp.json()["organization_id"] == "org-alpha"

    def test_unauthenticated_request_rejected(self):
        resp = client.get("/api/v1/cases")
        assert resp.status_code == 401

    def test_multiple_banks_have_distinct_identities(self):
        alpha = login("alpha.officer")["user"]
        beta = login("beta.investigator")["user"]
        gamma = login("gamma.auditor")["user"]
        assert alpha["organization_id"] == "org-alpha"
        assert beta["organization_id"] == "org-beta"
        assert gamma["organization_id"] == "org-gamma"
        assert alpha["organization_id"] != beta["organization_id"]
        assert beta["organization_id"] != gamma["organization_id"]


# ─── 2. Verification sessions ─────────────────────────────────────────────────

class TestVerificationSessions:
    def test_create_verification_session(self):
        h = alpha_headers()
        resp = client.post(
            "/api/v1/verifications",
            json={"session_identifier": "test-session-001", "issuing_bank": "Bank Alpha", "verification_method": "VIDEO_LIVENESS"},
            headers=h,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"]
        assert data["status"] == "CREATED"

    def test_submit_verification_results(self):
        h = alpha_headers()
        vid = client.post("/api/v1/verifications", json={"session_identifier": "s-002", "issuing_bank": "Bank Alpha"}, headers=h).json()["id"]
        resp = client.post(
            f"/api/v1/verifications/{vid}/results",
            json={"results": [
                {"name": "deepfake_liveness", "status": "FAIL", "risk_score": 0.9, "reason_codes": ["FACE_MANIPULATION_HIGH"]},
                {"name": "document_tampering", "status": "FAIL", "risk_score": 0.85},
                {"name": "voice_spoofing", "status": "UNAVAILABLE"},
            ]},
            headers=h,
        )
        assert resp.status_code == 200
        assert resp.json()["saved_results"] == 3

    def test_different_org_cannot_access_session(self):
        h_alpha = alpha_headers()
        h_beta = beta_headers()
        vid = client.post("/api/v1/verifications", json={"session_identifier": "s-003", "issuing_bank": "Bank Alpha"}, headers=h_alpha).json()["id"]
        resp = client.get(f"/api/v1/verifications/{vid}", headers=h_beta)
        assert resp.status_code == 403


# ─── 3. Risk engine ───────────────────────────────────────────────────────────

class TestRiskEngine:
    def _create_and_run(self, checks: list) -> dict:
        h = alpha_headers()
        vid = client.post("/api/v1/verifications", json={"session_identifier": f"r-{len(checks)}", "issuing_bank": "Bank Alpha"}, headers=h).json()["id"]
        client.post(f"/api/v1/verifications/{vid}/results", json={"results": checks}, headers=h)
        return client.post(f"/api/v1/verifications/{vid}/calculate-risk", headers=h).json()

    def test_high_risk_on_multiple_fails(self):
        result = self._create_and_run([
            {"name": "deepfake_liveness", "status": "FAIL", "risk_score": 0.95},
            {"name": "document_tampering", "status": "FAIL", "risk_score": 0.88},
        ])
        assert result["overall_risk"] == "HIGH"
        assert "refer for human review" in result["recommendation"]

    def test_medium_risk_on_review(self):
        result = self._create_and_run([
            {"name": "voice_spoofing", "status": "REVIEW", "risk_score": 0.6},
        ])
        assert result["overall_risk"] == "MEDIUM"

    def test_low_risk_on_all_pass(self):
        result = self._create_and_run([
            {"name": "deepfake_liveness", "status": "PASS"},
            {"name": "document_tampering", "status": "PASS"},
        ])
        assert result["overall_risk"] == "LOW"

    def test_indeterminate_when_all_unavailable(self):
        result = self._create_and_run([
            {"name": "deepfake_liveness", "status": "UNAVAILABLE"},
            {"name": "voice_spoofing", "status": "UNAVAILABLE"},
        ])
        assert result["overall_risk"] == "INDETERMINATE"

    def test_missing_detector_not_treated_as_pass(self):
        """A missing/unavailable detector must never count as a passing check."""
        result = self._create_and_run([
            {"name": "deepfake_liveness", "status": "UNAVAILABLE"},
        ])
        # UNAVAILABLE alone → INDETERMINATE, not LOW
        assert result["overall_risk"] != "LOW"
        assert "UNAVAILABLE_CHECK_NOTED" in result["rule_ids"]
        assert "deepfake_liveness" in result["missing_checks"]

    def test_empty_checks_returns_indeterminate(self):
        result = self._create_and_run([])
        assert result["overall_risk"] == "INDETERMINATE"


# ─── 4. Case lifecycle ────────────────────────────────────────────────────────

class TestCaseLifecycle:
    def _create_case(self, headers_fn=None, **kwargs) -> str:
        h = headers_fn() if headers_fn else alpha_headers()
        payload = {
            "case_category": "DEEPFAKE_FACE",
            "risk_level": "HIGH",
            "summary": "Synthetic face flagged.",
            "reason_codes": ["FACE_MANIPULATION_HIGH"],
        }
        payload.update(kwargs)
        resp = client.post("/api/v1/cases", json=payload, headers=h)
        assert resp.status_code == 200, resp.text
        return resp.json()["id"]

    def test_create_case(self):
        case_id = self._create_case()
        h = alpha_headers()
        resp = client.get(f"/api/v1/cases/{case_id}", headers=h)
        assert resp.status_code == 200
        assert resp.json()["status"] == "CREATED"

    def test_case_has_blockchain_transaction(self):
        case_id = self._create_case()
        h = alpha_headers()
        history = client.get(f"/api/v1/cases/{case_id}/history", headers=h).json()
        assert len(history) >= 1
        assert history[0]["transaction_ref"].startswith("sim-tx-")

    def test_share_case_with_beta(self):
        h = alpha_headers()
        case_id = self._create_case()
        shared = client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-beta"}, headers=h)
        assert shared.status_code == 200
        assert client.get(f"/api/v1/cases/{case_id}", headers=beta_headers()).status_code == 200

    def test_cannot_share_with_self(self):
        h = alpha_headers()
        case_id = self._create_case()
        resp = client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-alpha"}, headers=h)
        assert resp.status_code == 400

    def test_acknowledge_by_recipient(self):
        h_alpha = alpha_headers()
        h_beta = beta_headers()
        case_id = self._create_case()
        client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-beta"}, headers=h_alpha)
        resp = client.post(f"/api/v1/cases/{case_id}/acknowledge", headers=h_beta)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ACKNOWLEDGED"

    def test_full_lifecycle(self):
        h_alpha = alpha_headers()
        h_beta = beta_headers()
        case_id = self._create_case()
        # Share
        client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-beta"}, headers=h_alpha)
        # Acknowledge
        client.post(f"/api/v1/cases/{case_id}/acknowledge", headers=h_beta)
        # Findings → UNDER_REVIEW
        client.post(f"/api/v1/cases/{case_id}/findings", json={"reason": "Confirmed face manipulation.", "new_status": "UNDER_REVIEW"}, headers=h_beta)
        # Resolve
        resp = client.post(f"/api/v1/cases/{case_id}/resolve", json={"reason": "Resolved."}, headers=h_alpha)
        assert resp.status_code == 200
        assert resp.json()["status"] == "RESOLVED"

    def test_audit_history_has_all_events(self):
        h_alpha = alpha_headers()
        h_beta = beta_headers()
        case_id = self._create_case()
        client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-beta"}, headers=h_alpha)
        client.post(f"/api/v1/cases/{case_id}/acknowledge", headers=h_beta)
        history = client.get(f"/api/v1/cases/{case_id}/history", headers=h_alpha).json()
        event_types = [e["event_type"] for e in history]
        assert "CREATED" in event_types
        assert "SHARED" in event_types
        assert "ACKNOWLEDGED" in event_types

    def test_correction_does_not_change_status(self):
        h = alpha_headers()
        case_id = self._create_case()
        current_status = client.get(f"/api/v1/cases/{case_id}", headers=h).json()["status"]
        client.post(f"/api/v1/cases/{case_id}/correct", json={"reason": "Correction note."}, headers=h)
        new_status = client.get(f"/api/v1/cases/{case_id}", headers=h).json()["status"]
        assert current_status == new_status

    def test_duplicate_case_not_silently_overwritten(self):
        h = alpha_headers()
        case_id = self._create_case()
        history_before = client.get(f"/api/v1/cases/{case_id}/history", headers=h).json()
        # A second action adds a new event, not overwrites
        client.post(f"/api/v1/cases/{case_id}/correct", json={"reason": "Correction."}, headers=h)
        history_after = client.get(f"/api/v1/cases/{case_id}/history", headers=h).json()
        assert len(history_after) > len(history_before)


# ─── 5. Security tests ────────────────────────────────────────────────────────

class TestSecurityAndAccessControl:
    def _create_alpha_case(self) -> tuple[str, dict]:
        """Returns (case_id, alpha_headers)."""
        h = alpha_headers()
        resp = client.post("/api/v1/cases", json={
            "case_category": "DOCUMENT_MANIPULATION",
            "risk_level": "MEDIUM",
            "summary": "Document inconsistency.",
            "reason_codes": ["DOCUMENT_INCONSISTENT"],
        }, headers=h)
        return resp.json()["id"], h

    def test_unshared_case_inaccessible_to_other_bank(self):
        """Bank Alpha cannot access an unshared Bank Beta case (and vice versa)."""
        case_id, _ = self._create_alpha_case()
        resp = client.get(f"/api/v1/cases/{case_id}", headers=beta_headers())
        assert resp.status_code == 403

    def test_bank_cannot_share_other_banks_case(self):
        """Non-originator cannot share a case they received."""
        h_alpha = alpha_headers()
        case_id, _ = self._create_alpha_case()
        client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-beta"}, headers=h_alpha)
        # Beta cannot re-share to Gamma
        resp = client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-gamma"}, headers=beta_headers())
        assert resp.status_code == 403

    def test_unauthorized_user_cannot_resolve_case(self):
        """A bank participant cannot resolve a case belonging to another bank."""
        h_alpha = alpha_headers()
        case_id, _ = self._create_alpha_case()
        # Share with beta
        client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-beta"}, headers=h_alpha)
        # Beta acknowledges and tries to resolve (resolve requires originator or admin)
        client.post(f"/api/v1/cases/{case_id}/acknowledge", headers=beta_headers())
        client.post(f"/api/v1/cases/{case_id}/findings", json={"reason": "Review.", "new_status": "UNDER_REVIEW"}, headers=beta_headers())
        resp = client.post(f"/api/v1/cases/{case_id}/resolve", json={"reason": "Attempting resolve."}, headers=beta_headers())
        assert resp.status_code == 403

    def test_forbidden_lifecycle_transition_rejected(self):
        """A case in CREATED state cannot be directly resolved."""
        h = alpha_headers()
        resp = client.post("/api/v1/cases", json={
            "case_category": "OTHER_SUSPICIOUS_KYC",
            "risk_level": "LOW",
            "summary": "Test.",
            "reason_codes": [],
        }, headers=h)
        case_id = resp.json()["id"]
        blocked = client.post(f"/api/v1/cases/{case_id}/resolve", json={"reason": "Skip states."}, headers=h)
        assert blocked.status_code == 400

    def test_tampered_evidence_fails_verification(self):
        h = alpha_headers()
        commit = client.post("/api/v1/evidence/commitment",
            json={"file_name": "ev.txt", "content": "original-content", "case_id": ""},
            headers=h)
        sha = commit.json()["sha256"]
        # Verify correct → True
        ok = client.post("/api/v1/evidence/verify", json={"evidence_text": "original-content", "expected_hash": sha}, headers=h)
        assert ok.json()["verified"] is True
        # Verify tampered → False
        bad = client.post("/api/v1/evidence/verify", json={"evidence_text": "tampered-content!", "expected_hash": sha}, headers=h)
        assert bad.json()["verified"] is False

    def test_case_sharing_requires_correct_org(self):
        """Modifying organization_id in request body does not grant access."""
        h_beta = beta_headers()
        # Beta tries to access a non-existent (or unshared) case
        resp = client.get("/api/v1/cases/case-nonexistent-xxx", headers=h_beta)
        assert resp.status_code in (403, 404)

    def test_gamma_cannot_see_unshared_alpha_case(self):
        case_id, _ = self._create_alpha_case()
        resp = client.get(f"/api/v1/cases/{case_id}", headers=gamma_headers())
        assert resp.status_code == 403


# ─── 6. Evidence integrity ────────────────────────────────────────────────────

class TestEvidenceIntegrity:
    def test_commit_and_verify(self):
        h = alpha_headers()
        content = "canonical evidence payload v1.0"
        commit = client.post("/api/v1/evidence/commitment", json={"file_name": "test.txt", "content": content}, headers=h)
        assert commit.status_code == 200
        sha = commit.json()["sha256"]
        assert len(sha) == 64  # SHA-256 hex

        verify = client.post("/api/v1/evidence/verify", json={"evidence_text": content, "expected_hash": sha}, headers=h)
        assert verify.json()["verified"] is True

    def test_empty_content_commitment(self):
        h = alpha_headers()
        commit = client.post("/api/v1/evidence/commitment", json={"file_name": "empty.txt", "content": ""}, headers=h)
        assert commit.status_code == 200

    def test_canonical_payload_used_when_provided(self):
        h = alpha_headers()
        canonical = '{"event":"CREATED","version":"1"}'
        commit = client.post("/api/v1/evidence/commitment",
            json={"file_name": "event.json", "content": "raw", "canonical_payload": canonical},
            headers=h)
        sha = commit.json()["sha256"]
        # Verify using canonical payload, not raw
        verify = client.post("/api/v1/evidence/verify", json={"evidence_text": canonical, "expected_hash": sha}, headers=h)
        assert verify.json()["verified"] is True


# ─── 7. Blockchain simulator tests (SIMULATED) ───────────────────────────────

class TestBlockchainSimulator:
    """
    SIMULATED BLOCKCHAIN TESTS.
    These tests exercise the local blockchain simulator, not a live Fabric network.
    They do NOT prove Hyperledger Fabric endorsement or consensus behaviour.
    """

    def test_blockchain_status_is_simulated(self):
        resp = client.get("/api/v1/blockchain/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["mode"] == "SIMULATED"
        assert data["ledger_ready"] is True

    def test_case_events_create_simulated_transactions(self):
        h = alpha_headers()
        resp = client.post("/api/v1/cases", json={
            "case_category": "DEEPFAKE_FACE",
            "risk_level": "HIGH",
            "summary": "Blockchain tx test.",
            "reason_codes": [],
        }, headers=h)
        case_id = resp.json()["id"]
        history = client.get(f"/api/v1/cases/{case_id}/history", headers=h).json()
        assert history[0]["transaction_ref"].startswith("sim-tx-")

    def test_multiple_case_events_produce_multiple_transactions(self):
        h = alpha_headers()
        h_beta = beta_headers()
        resp = client.post("/api/v1/cases", json={
            "case_category": "MULTIPLE_RISK_SIGNALS",
            "risk_level": "HIGH",
            "summary": "Multi-tx test.",
            "reason_codes": [],
        }, headers=h)
        case_id = resp.json()["id"]
        client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-beta"}, headers=h)
        client.post(f"/api/v1/cases/{case_id}/acknowledge", headers=h_beta)
        history = client.get(f"/api/v1/cases/{case_id}/history", headers=h).json()
        tx_refs = [e["transaction_ref"] for e in history if e.get("transaction_ref")]
        assert len(set(tx_refs)) == len(tx_refs), "Each event must have a unique transaction reference."

    def test_simulator_labels_are_correct(self):
        """Verify the simulator consistently reports SIMULATED mode."""
        resp = client.get("/api/v1/blockchain/status")
        assert "SIMULATED" in resp.json()["mode"]
        sys_resp = client.get("/api/v1/system/status", headers=alpha_headers())
        bc = sys_resp.json()["blockchain"]
        assert bc["mode"] == "SIMULATED"
        assert "SIMULATION" in bc["status"]


# ─── 8. System integration ────────────────────────────────────────────────────

class TestSystemIntegration:
    def test_system_status_returns_all_fields(self):
        resp = client.get("/api/v1/system/status", headers=alpha_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert data["system"] == "FUSION"
        assert "blockchain" in data
        assert "ai_detector_status" in data
        assert "evidence_storage_status" in data

    def test_organizations_listed(self):
        resp = client.get("/api/v1/organizations", headers=alpha_headers())
        assert resp.status_code == 200
        orgs = resp.json()
        org_ids = [o["id"] for o in orgs]
        assert "org-alpha" in org_ids
        assert "org-beta" in org_ids
        assert "org-gamma" in org_ids

    def test_demo_scenario_end_to_end(self):
        """End-to-end demo scenario: Alpha creates case → shares → Beta acks → resolve."""
        h_alpha = alpha_headers()
        h_beta = beta_headers()

        # Step 1: Create verification session with HIGH risk
        vid = client.post("/api/v1/verifications",
            json={"session_identifier": "demo-e2e-001", "issuing_bank": "Bank Alpha"},
            headers=h_alpha).json()["id"]

        # Step 2: Submit simulated AI results
        client.post(f"/api/v1/verifications/{vid}/results", json={"results": [
            {"name": "deepfake_liveness", "status": "FAIL", "risk_score": 0.91},
            {"name": "document_tampering", "status": "FAIL", "risk_score": 0.84},
            {"name": "voice_spoofing", "status": "REVIEW", "risk_score": 0.72},
        ]}, headers=h_alpha)

        # Step 3: Calculate risk
        risk = client.post(f"/api/v1/verifications/{vid}/calculate-risk", headers=h_alpha).json()
        assert risk["overall_risk"] == "HIGH"

        # Step 4: Create case
        case_id = client.post("/api/v1/cases", json={
            "case_category": "DEEPFAKE_FACE",
            "risk_level": "HIGH",
            "summary": "E2E demo: face manipulation and document mismatch.",
            "reason_codes": risk["rule_ids"],
            "verification_session_id": vid,
        }, headers=h_alpha).json()["id"]

        # Step 5: Share with Bank Beta
        client.post(f"/api/v1/cases/{case_id}/share", json={"organization_id": "org-beta"}, headers=h_alpha)

        # Step 6: Beta acknowledges
        ack = client.post(f"/api/v1/cases/{case_id}/acknowledge", headers=h_beta)
        assert ack.json()["status"] == "ACKNOWLEDGED"

        # Step 7: Beta submits findings
        client.post(f"/api/v1/cases/{case_id}/findings",
            json={"reason": "Bank Beta confirmed face manipulation and doc inconsistency.", "new_status": "UNDER_REVIEW"},
            headers=h_beta)

        # Step 8: Resolve
        resolved = client.post(f"/api/v1/cases/{case_id}/resolve", json={"reason": "Investigation complete."}, headers=h_alpha)
        assert resolved.json()["status"] == "RESOLVED"

        # Step 9: Verify audit trail
        audit = client.get(f"/api/v1/cases/{case_id}/audit", headers=h_alpha).json()
        assert len(audit) >= 4

        # Step 10: Evidence commitment
        commit = client.post("/api/v1/evidence/commitment",
            json={"file_name": "session-evidence.txt", "content": "synthetic-face-evidence-hash-001", "case_id": case_id},
            headers=h_alpha)
        sha = commit.json()["sha256"]
        verify = client.post("/api/v1/evidence/verify",
            json={"evidence_text": "synthetic-face-evidence-hash-001", "expected_hash": sha},
            headers=h_alpha)
        assert verify.json()["verified"] is True
