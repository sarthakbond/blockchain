/*
FUSION Chaincode — Hyperledger Fabric
======================================
Package: fusion

Target: Hyperledger Fabric 2.5+ with peer chaincode lifecycle.

This chaincode implements the FUSION cross-bank KYC fraud investigation
ledger functions.  It stores only minimum-necessary, non-personal data
on-chain:

  - Opaque case identifiers (UUIDs)
  - Authorized organization identifiers (MSP IDs)
  - Event types and timestamps
  - Case status transitions
  - Cryptographic evidence commitments (SHA-256)
  - Policy and version references

It does NOT store:
  - PAN, Aadhaar, passport numbers, bank account numbers
  - Names, phone numbers, dates of birth, addresses
  - Face images, videos, voice recordings
  - Raw AI model inputs or outputs
  - Detailed investigation notes

Build:
  cd blockchain/chaincode
  go mod tidy
  peer lifecycle chaincode package fusion.tar.gz \
    --path . --lang golang --label fusion_1.0

Deploy using Fabric operator or test network scripts in blockchain/network/.
*/
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Data structures ──────────────────────────────────────────────────────────

// CaseRecord is the on-chain state for a fraud investigation case.
// Only minimum-necessary, non-personal fields are stored.
type CaseRecord struct {
	CaseID             string   `json:"case_id"`
	Organization       string   `json:"organization"`        // MSP ID of originator
	CaseCategory       string   `json:"case_category"`
	RiskLevel          string   `json:"risk_level"`
	Status             string   `json:"status"`
	Participants       []string `json:"participants"`        // MSP IDs of authorized orgs
	EvidenceCommitment string   `json:"evidence_commitment"` // SHA-256 hash only
	AccessPolicy       string   `json:"access_policy"`
	CreatedAt          string   `json:"created_at"`
	UpdatedAt          string   `json:"updated_at"`
}

// CaseEvent is an append-only audit event stored in ledger history.
type CaseEvent struct {
	EventType      string `json:"event_type"`
	Organization   string `json:"organization"`
	ActorRole      string `json:"actor_role"`
	PreviousStatus string `json:"previous_status"`
	NewStatus      string `json:"new_status"`
	Reason         string `json:"reason"`
	Timestamp      string `json:"timestamp"`
}

// VerificationRecord is the on-chain record of a KYC session (metadata only).
type VerificationRecord struct {
	SessionID          string `json:"session_id"`
	Organization       string `json:"organization"`
	ChallengeNonce     string `json:"challenge_nonce"`
	VerificationMethod string `json:"verification_method"`
	EvidenceReference  string `json:"evidence_reference"` // opaque reference, not raw evidence
	CreatedAt          string `json:"created_at"`
}

// valid lifecycle transitions
var validTransitions = map[string][]string{
	"CREATED":                {"SHARED", "CLOSED_WITHOUT_FINDING"},
	"SHARED":                 {"ACKNOWLEDGED", "UNDER_REVIEW", "DISPUTED", "ESCALATED", "CLOSED_WITHOUT_FINDING"},
	"ACKNOWLEDGED":           {"UNDER_REVIEW", "NEEDS_MORE_INFORMATION", "DISPUTED", "ESCALATED"},
	"NEEDS_MORE_INFORMATION": {"UNDER_REVIEW", "DISPUTED", "ESCALATED"},
	"UNDER_REVIEW":           {"RESOLVED", "DISPUTED", "ESCALATED", "NEEDS_MORE_INFORMATION"},
	"DISPUTED":               {"UNDER_REVIEW", "ESCALATED", "RESOLVED"},
	"ESCALATED":              {"UNDER_REVIEW", "RESOLVED", "DISPUTED"},
	"RESOLVED":               {"CLOSED_WITHOUT_FINDING"},
}

// ─── SmartContract ────────────────────────────────────────────────────────────

type SmartContract struct {
	contractapi.Contract
}

// ─── CreateVerificationRecord ─────────────────────────────────────────────────

// CreateVerificationRecord stores a new KYC session metadata record.
// No PII or raw biometrics should be passed in any argument.
func (s *SmartContract) CreateVerificationRecord(
	ctx contractapi.TransactionContextInterface,
	sessionID, challengeNonce, verificationMethod, evidenceReference string,
) error {
	org, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	key := verificationKey(sessionID)
	existing, _ := ctx.GetStub().GetState(key)
	if existing != nil {
		return fmt.Errorf("verification record %s already exists", sessionID)
	}
	record := VerificationRecord{
		SessionID:          sessionID,
		Organization:       org,
		ChallengeNonce:     challengeNonce,
		VerificationMethod: verificationMethod,
		EvidenceReference:  evidenceReference,
		CreatedAt:          now(),
	}
	return putState(ctx, key, record)
}

// ─── CreateFraudCase ──────────────────────────────────────────────────────────

func (s *SmartContract) CreateFraudCase(
	ctx contractapi.TransactionContextInterface,
	caseID, caseCategory, riskLevel, evidenceCommitment, accessPolicy string,
) error {
	org, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	key := caseKey(caseID)
	if existing, _ := ctx.GetStub().GetState(key); existing != nil {
		return fmt.Errorf("case %s already exists", caseID)
	}
	record := CaseRecord{
		CaseID:             caseID,
		Organization:       org,
		CaseCategory:       caseCategory,
		RiskLevel:          riskLevel,
		Status:             "CREATED",
		Participants:       []string{org},
		EvidenceCommitment: evidenceCommitment,
		AccessPolicy:       accessPolicy,
		CreatedAt:          now(),
		UpdatedAt:          now(),
	}
	if err := putState(ctx, key, record); err != nil {
		return err
	}
	return s.emitEvent(ctx, caseID, org, "", "CREATED", "CREATED", "Case created.", "")
}

// ─── ShareCase ────────────────────────────────────────────────────────────────

func (s *SmartContract) ShareCase(
	ctx contractapi.TransactionContextInterface,
	caseID, recipientOrg, reason string,
) error {
	record, err := s.requireCase(ctx, caseID)
	if err != nil {
		return err
	}
	org, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	if org != record.Organization {
		return fmt.Errorf("only the originating organization may share this case")
	}
	for _, p := range record.Participants {
		if p == recipientOrg {
			return fmt.Errorf("case already shared with %s", recipientOrg)
		}
	}
	prev := record.Status
	record.Participants = append(record.Participants, recipientOrg)
	record.Status = "SHARED"
	record.UpdatedAt = now()
	if err := putState(ctx, caseKey(caseID), record); err != nil {
		return err
	}
	return s.emitEvent(ctx, caseID, org, prev, "SHARED", "SHARED", reason, "")
}

// ─── AcknowledgeCase ──────────────────────────────────────────────────────────

func (s *SmartContract) AcknowledgeCase(
	ctx contractapi.TransactionContextInterface,
	caseID, reason string,
) error {
	return s.transition(ctx, caseID, "ACKNOWLEDGED", "ACKNOWLEDGED", reason)
}

// ─── SubmitReviewFinding ──────────────────────────────────────────────────────

func (s *SmartContract) SubmitReviewFinding(
	ctx contractapi.TransactionContextInterface,
	caseID, reason string,
) error {
	return s.transition(ctx, caseID, "UNDER_REVIEW", "REVIEW_FINDING", reason)
}

// ─── RequestAdditionalInformation ────────────────────────────────────────────

func (s *SmartContract) RequestAdditionalInformation(
	ctx contractapi.TransactionContextInterface,
	caseID, reason string,
) error {
	return s.transition(ctx, caseID, "NEEDS_MORE_INFORMATION", "REQUEST_INFORMATION", reason)
}

// ─── DisputeCase ──────────────────────────────────────────────────────────────

func (s *SmartContract) DisputeCase(
	ctx contractapi.TransactionContextInterface,
	caseID, reason string,
) error {
	return s.transition(ctx, caseID, "DISPUTED", "DISPUTED", reason)
}

// ─── EscalateCase ─────────────────────────────────────────────────────────────

func (s *SmartContract) EscalateCase(
	ctx contractapi.TransactionContextInterface,
	caseID, reason string,
) error {
	return s.transition(ctx, caseID, "ESCALATED", "ESCALATED", reason)
}

// ─── ResolveCase ──────────────────────────────────────────────────────────────

func (s *SmartContract) ResolveCase(
	ctx contractapi.TransactionContextInterface,
	caseID, reason string,
) error {
	return s.transition(ctx, caseID, "RESOLVED", "RESOLVED", reason)
}

// ─── CloseCaseWithoutFinding ──────────────────────────────────────────────────

func (s *SmartContract) CloseCaseWithoutFinding(
	ctx contractapi.TransactionContextInterface,
	caseID, reason string,
) error {
	return s.transition(ctx, caseID, "CLOSED_WITHOUT_FINDING", "CLOSED_WITHOUT_FINDING", reason)
}

// ─── AppendCorrection ─────────────────────────────────────────────────────────

// AppendCorrection appends a corrective event to the case without changing its
// status.  It does NOT overwrite or delete previous events.
func (s *SmartContract) AppendCorrection(
	ctx contractapi.TransactionContextInterface,
	caseID, reason string,
) error {
	record, err := s.requireCase(ctx, caseID)
	if err != nil {
		return err
	}
	org, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	if org != record.Organization {
		return fmt.Errorf("only the originating organization may append corrections")
	}
	return s.emitEvent(ctx, caseID, org, record.Status, "CORRECTION", record.Status, reason, "")
}

// ─── GetAuthorizedCaseSummary ─────────────────────────────────────────────────

func (s *SmartContract) GetAuthorizedCaseSummary(
	ctx contractapi.TransactionContextInterface,
	caseID string,
) (string, error) {
	record, err := s.requireCase(ctx, caseID)
	if err != nil {
		return "", err
	}
	org, err := callerMSP(ctx)
	if err != nil {
		return "", err
	}
	authorized := false
	for _, p := range record.Participants {
		if p == org {
			authorized = true
			break
		}
	}
	if !authorized {
		return "", fmt.Errorf("organization %s is not authorized to view case %s", org, caseID)
	}
	summary := map[string]interface{}{
		"case_id":             record.CaseID,
		"case_category":       record.CaseCategory,
		"risk_level":          record.RiskLevel,
		"status":              record.Status,
		"evidence_commitment": record.EvidenceCommitment,
		"created_at":          record.CreatedAt,
	}
	b, err := json.Marshal(summary)
	return string(b), err
}

// ─── GetCaseHistory ───────────────────────────────────────────────────────────

func (s *SmartContract) GetCaseHistory(
	ctx contractapi.TransactionContextInterface,
	caseID string,
) (string, error) {
	it, err := ctx.GetStub().GetHistoryForKey(caseKey(caseID))
	if err != nil {
		return "", err
	}
	defer it.Close()
	var results []map[string]interface{}
	for it.HasNext() {
		entry, err := it.Next()
		if err != nil {
			return "", err
		}
		results = append(results, map[string]interface{}{
			"tx_id":     entry.TxId,
			"timestamp": entry.Timestamp.String(),
			"value":     json.RawMessage(entry.Value),
		})
	}
	b, err := json.Marshal(results)
	return string(b), err
}

// ─── VerifyEvidenceCommitment ─────────────────────────────────────────────────

// VerifyEvidenceCommitment computes the SHA-256 of the provided content and
// compares it against the stored commitment on-chain.
func (s *SmartContract) VerifyEvidenceCommitment(
	ctx contractapi.TransactionContextInterface,
	caseID, content string,
) (string, error) {
	record, err := s.requireCase(ctx, caseID)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(content))
	actual := hex.EncodeToString(sum[:])
	result := map[string]interface{}{
		"verified":      actual == record.EvidenceCommitment,
		"actual_hash":   actual,
		"expected_hash": record.EvidenceCommitment,
	}
	b, _ := json.Marshal(result)
	return string(b), nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func (s *SmartContract) requireCase(ctx contractapi.TransactionContextInterface, caseID string) (*CaseRecord, error) {
	b, err := ctx.GetStub().GetState(caseKey(caseID))
	if err != nil {
		return nil, fmt.Errorf("ledger read error: %w", err)
	}
	if b == nil {
		return nil, fmt.Errorf("case %s not found", caseID)
	}
	var record CaseRecord
	if err := json.Unmarshal(b, &record); err != nil {
		return nil, err
	}
	return &record, nil
}

func (s *SmartContract) transition(
	ctx contractapi.TransactionContextInterface,
	caseID, newStatus, eventType, reason string,
) error {
	record, err := s.requireCase(ctx, caseID)
	if err != nil {
		return err
	}
	org, err := callerMSP(ctx)
	if err != nil {
		return err
	}
	authorized := false
	for _, p := range record.Participants {
		if p == org {
			authorized = true
			break
		}
	}
	if !authorized {
		return fmt.Errorf("organization %s is not a participant in case %s", org, caseID)
	}
	allowed := validTransitions[record.Status]
	ok := false
	for _, a := range allowed {
		if a == newStatus {
			ok = true
			break
		}
	}
	if !ok {
		return fmt.Errorf("invalid transition from %s to %s", record.Status, newStatus)
	}
	prev := record.Status
	record.Status = newStatus
	record.UpdatedAt = now()
	if err := putState(ctx, caseKey(caseID), record); err != nil {
		return err
	}
	return s.emitEvent(ctx, caseID, org, prev, newStatus, eventType, reason, "")
}

func (s *SmartContract) emitEvent(
	ctx contractapi.TransactionContextInterface,
	caseID, org, prevStatus, newStatus, eventType, reason, txRef string,
) error {
	event := CaseEvent{
		EventType:      eventType,
		Organization:   org,
		PreviousStatus: prevStatus,
		NewStatus:      newStatus,
		Reason:         reason,
		Timestamp:      now(),
	}
	b, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return ctx.GetStub().SetEvent(fmt.Sprintf("FusionEvent.%s.%s", caseID, eventType), b)
}

func callerMSP(ctx contractapi.TransactionContextInterface) (string, error) {
	id, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("failed to get caller MSP ID: %w", err)
	}
	return id, nil
}

func caseKey(id string) string         { return "case:" + id }
func verificationKey(id string) string { return "verification:" + id }

func putState(ctx contractapi.TransactionContextInterface, key string, v interface{}) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(key, b)
}

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// ─── Entry point ─────────────────────────────────────────────────────────────

func main() {
	cc, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		panic(fmt.Sprintf("failed to create chaincode: %v", err))
	}
	if err := cc.Start(); err != nil {
		panic(fmt.Sprintf("failed to start chaincode: %v", err))
	}
}
