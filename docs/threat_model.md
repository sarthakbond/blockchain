# FUSION Security Architecture & Threat Model

## 1. Overview
FUSION coordinates cross-bank identity fraud investigation using permissioned distributed ledger technology (Hyperledger Fabric architecture). This document outlines the threat vectors, security boundaries, and privacy protections implemented in the system.

## 2. Trust Model & Security Boundaries
- **Participants**: Regulated Financial Institutions (Bank Alpha, Bank Beta, Bank Gamma).
- **Consensus**: Multi-organization endorsement policy (`AND('OrgAlphaMSP.peer', 'OrgBetaMSP.peer')` or channel endorsement).
- **Data Segregation**:
  - **On-Chain**: Opaque identifiers (UUIDs), SHA-256 evidence commitments, state transitions, organization MSP IDs, timestamp proofs.
  - **Off-Chain**: Raw KYC documents, biometric biometric templates, video captures, customer PII.
  - **Transient / Data-At-Rest**: Encrypted evidence storage accessed strictly on a need-to-know basis.

## 3. Threat Analysis & Mitigations

| Threat Vector | Severity | Attack Description | Mitigation Implemented |
|---|---|---|---|
| **Identity Correlation & Surveillance** | Critical | External party or non-investigating bank tracks customer activities across banks. | **No PII on chain**. Ephemeral session UUIDs + opaque subject tokens. Unshared cases invisible to third banks. |
| **Evidence Tampering** | Critical | Dishonest bank or rogue actor alters historical KYC images or AI evaluation logs. | **SHA-256 Evidence Commitments** recorded on append-only ledger. Verification endpoint validates byte hash integrity. |
| **Unauthorized Case Sharing** | High | Bank attempts to share or query cases owned by a different institution without consent. | RBAC and Org authorization checks in API layer and chaincode. Only owning organization can share cases. |
| **Algorithmic Injustice / Blacklisting** | High | Imperfect AI model leads to automatic denial of financial services across all banks. | **No automated blacklisting**. Risk engine produces recommendations ("MANUAL_REVIEW_REQUIRED"); humans make final determinations. |
| **Audit Trail Repudiation** | Medium | Bank claims it never received or acted upon a fraud alert. | Mandatory bilateral acknowledgment transactions logged with actor ID and timestamp. |
| **Model Invalidation** | Medium | Outdated or compromised AI detector produces misleading outputs. | Every check records `model_id`, `model_version`, and human-readable explanation. Missing detectors yield INDETERMINATE, never PASS. |

## 4. Privacy Protections
1. **Zero Customer PII On-Ledger**: Full compliance with privacy regulations (GDPR Art. 17 right-to-be-forgotten compatibility via cryptographic commitments).
2. **State Machine Strictness**: Unilateral status manipulation is rejected. Statuses flow linearly: `CREATED -> SHARED -> ACKNOWLEDGED -> UNDER_REVIEW -> RESOLVED / CLOSED`.
3. **Auditable Corrections**: Inadvertent errors or mistaken identity flags cannot overwrite historical blocks; they must be corrected via append-only `CORRECTION` events.
