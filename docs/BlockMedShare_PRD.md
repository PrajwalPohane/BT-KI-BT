**Product Requirements Document (PRD)**  
**Product Name:** BlockMedShare  
**Version:** 1.0 (Draft from provided paper)  
**Date:** April 20, 2026  
**Prepared For:** Cross-institution healthcare data sharing program

## 1. Product Overview
BlockMedShare is a consent-driven, blockchain-backed platform for secure medical data sharing across independent healthcare institutions.  
It enables patients to authorize, review, and revoke access to specific data categories while ensuring all access attempts are cryptographically enforced and immutably logged.

## 2. Problem Statement
Current healthcare data exchange is fragmented and opaque.

1. Records are siloed per institution.
2. Cross-hospital sharing is often manual, slow, and inconsistent.
3. Patients lack transparent control and visibility into who accessed their records.
4. Centralized trust models create single points of failure and weak auditability.
5. Compliance needs (HIPAA/GDPR-aligned controls, traceability, least privilege) are hard to enforce consistently across organizations.

## 3. Vision and Goals
**Vision:** Make cross-institution medical data exchange patient-controlled, verifiable, and accountable by design.

**Primary Goals:**
1. Patient-first consent lifecycle (grant, inspect, revoke).
2. Deterministic access control enforced via smart contracts.
3. Immutable audit logging of all grant and deny events.
4. Off-chain encrypted storage of medical content with on-chain integrity commitments.
5. Verified consortium membership to prevent rogue participants.

## 4. Success Metrics (KPIs)
1. Audit completeness: 100% of access attempts logged.
2. Unauthorized access detection: 100% detection and denial of invalid requests.
3. Mean access verification latency: target ≤ 2.0 seconds (non-emergency workflows).
4. Consent revocation effectiveness latency: target ≤ 3.0 seconds post-confirmation.
5. Throughput: target around 300+ TPS under nominal consortium load.
6. Patient transparency metric: 100% access events visible in patient history dashboard.
7. Compliance reporting readiness: exportable audit reports generated on demand.

## 5. Stakeholders and Users
1. Patients (data owners and consent authorities).
2. Healthcare providers/hospitals (data custodians and requesters).
3. Consortium governance/registry authority (institution onboarding).
4. Compliance, legal, and audit teams.
5. Security and platform operations teams.
6. EHR integration and hospital IT teams.

## 6. Personas
1. Patient Priya  
Needs simple controls to allow and revoke access by institution, data type, and purpose, with clear history.
2. Clinician Dr. Rao  
Needs fast, reliable access to external records for treatment with minimal workflow friction.
3. Compliance Officer Anika  
Needs tamper-proof logs, searchable audit trails, and exportable evidence.
4. Registry Admin Arun  
Needs vetting workflows to onboard only legitimate institutions.

## 7. Scope
### In Scope (MVP)
1. Consent management smart contract.
2. Access control smart contract with purpose and expiry checks.
3. Audit log smart contract for grant/deny events.
4. Consortium identity registry and onboarding controls.
5. Patient dashboard for consent and history.
6. Hospital request interface and backend integration APIs.
7. Off-chain AES-256-GCM encrypted storage and SHA-256 integrity checks.
8. Event-driven notifications for new access and consent status changes.
9. CSV audit export and dashboard reporting.

### Out of Scope (MVP)
1. Emergency break-glass policy framework.
2. Insurance claims workflow integration.
3. Full cross-country legal federation.
4. AI model governance workflows for diagnosis processing.

## 8. Functional Requirements
### FR-1 Consent Lifecycle
1. Patients can create consent by institution, data type, purpose, and expiry.
2. Patients can revoke active consent at any time.
3. Consent state must be queryable in real time by authorized interfaces.
4. Consent creation and revocation must require patient-signed transactions.
5. Consent records must include active status and expiry timestamp.

**Acceptance Criteria:**
1. New consent appears on-chain and in patient UI after confirmation.
2. Revoked consent becomes ineffective on subsequent access attempts.
3. Access with expired consent is denied.

### FR-2 Access Request and Verification
1. Hospitals submit access requests with patient identifier, data type, and declared purpose.
2. Access control contract validates consent existence, active state, expiry, and purpose match.
3. System returns grant or deny deterministically.
4. Both outcomes trigger auditable event creation.

**Acceptance Criteria:**
1. No consent: deny and log.
2. Expired consent: deny and log.
3. Purpose mismatch: deny and log.
4. Valid consent: grant token and log.

### FR-3 Immutable Audit Logging
1. Every access decision must create a non-editable audit record.
2. Audit record fields include patient ID, institution ID, data type, timestamp, purpose, decision, token hash.
3. Audit query module supports filtering by patient, institution, date range, and decision.

**Acceptance Criteria:**
1. 100% of requests produce corresponding log entries.
2. Log entries are immutable post-write.
3. Compliance export can be generated in CSV.

### FR-4 Consortium Identity Registry
1. Only verified institutions can join the network.
2. Registry must support onboarding and revocation/suspension workflows.
3. Unregistered entities must be unable to submit valid requests.

**Acceptance Criteria:**
1. Unverified institution request is rejected.
2. Registry status updates are reflected in access eligibility.

### FR-5 Off-Chain Data Security
1. Medical records remain off-chain.
2. Records are encrypted with AES-256-GCM before storage.
3. SHA-256 hash of ciphertext is committed for integrity checks.
4. Decryption key transfer occurs via secure authenticated channel (not blockchain).

**Acceptance Criteria:**
1. Hash mismatch flags tampering.
2. No plaintext medical content is exposed on-chain.

### FR-6 Patient and Hospital Applications
1. Patient app supports consent management and access history.
2. Hospital app supports request submission and status tracking.
3. Real-time updates via event subscriptions.

**Acceptance Criteria:**
1. Patient receives visibility on all grant/deny events.
2. Hospital users can see request outcomes with reason codes.

### FR-7 Reporting and Analytics
1. Dashboard for access frequency and denial trends.
2. Audit completeness and unauthorized attempt metrics.
3. Export capabilities for regulators and internal audits.

## 9. Non-Functional Requirements
1. Security: end-to-end cryptographic integrity; least-privilege access.
2. Performance: target mean verification latency around 1.8 seconds.
3. Scalability: support 5 to 50+ consortium nodes and bursty request loads.
4. Availability: healthcare-grade uptime targets for non-emergency exchange.
5. Reliability: no silent failure in logging pipeline.
6. Interoperability: APIs compatible with hospital EHR integration layers.
7. Traceability: every request must be attributable and non-repudiable.
8. Maintainability: modular contracts and service architecture.
9. Compliance readiness: supports HIPAA/GDPR-aligned audit and consent evidence patterns.

## 10. High-Level System Design
1. Blockchain Layer  
Permissioned Ethereum-compatible network with three contracts: Consent, Access Control, Audit Log.
2. Backend Services  
Node.js/Express APIs, authentication, event listener services, integration adapters.
3. Frontend Layer  
Patient and hospital dashboards (web interfaces).
4. Storage Layer  
Hospital systems/IPFS/S3 for encrypted content; hashes and consent metadata on-chain.
5. Governance Layer  
Consortium registry for institution identity trust.

## 11. Core Workflow
1. Patient grants consent with scope, purpose, and expiry.
2. Hospital submits access request.
3. Access contract validates consent and purpose.
4. System emits grant/deny and writes immutable audit event.
5. If granted, data holder provides encrypted content and secure key path.
6. Requesting institution verifies integrity against on-chain hash.
7. Patient and compliance dashboards reflect event status.

## 12. Data Requirements
1. Patient pseudonymous identifier.
2. Institution identifier tied to registry status.
3. Data type taxonomy (radiology, pharmacy, surgical notes, etc.).
4. Consent object with purpose, expiry, and active flag.
5. Access request object with declared purpose and timestamp.
6. Audit object with outcome and token/hash references.

## 13. Security and Compliance Requirements
1. Patient key custody model and signing requirements.
2. Tamper-evident records through immutable ledger + hash commitments.
3. No direct storage of sensitive health payloads on-chain.
4. Cryptographic auditability for legal and forensic investigation.
5. Role-based controls in applications and APIs.
6. Strong authentication between institutional services.
7. Regulatory mapping for consent evidence, data minimization, and accountability.

## 14. Testing and Validation Plan
1. Unit tests for smart contracts (consent, access, logging).
2. Integration tests across blockchain, backend, UI, and storage.
3. Adversarial security tests:
   1. Unauthorized requests.
   2. Expired/revoked consent replay.
   3. Purpose mismatch attempts.
   4. Tampered off-chain payload detection.
4. Load tests from 10 to 500 requests/sec equivalent scenarios.
5. Acceptance tests for compliance export and patient visibility.

## 15. Release Plan
1. Phase 1 (Weeks 1-2): architecture and requirements finalization.
2. Phase 2 (Weeks 3-4): smart contracts and unit testing.
3. Phase 3 (Weeks 5-6): backend APIs and EHR integration interfaces.
4. Phase 4 (Weeks 7-8): patient and hospital dashboards.
5. Phase 5 (Weeks 9-10): end-to-end integration and consortium simulation.
6. Phase 6 (Weeks 11-12): performance/security evaluation and go-live readiness report.

## 16. Risks and Mitigations
1. Blockchain confirmation latency impacts urgent care use cases.  
Mitigation: classify emergency workflows separately; introduce controlled break-glass model later.
2. Key management complexity for patients and institutions.  
Mitigation: managed key custody options with recovery safeguards.
3. Legal variance across jurisdictions.  
Mitigation: policy engine and jurisdiction-aware registry extensions.
4. Legacy EHR integration challenges.  
Mitigation: adapter-based integration layer and phased onboarding playbook.
5. Governance capture risk in consortium registry.  
Mitigation: transparent governance controls and audit of onboarding decisions.

## 17. Future Enhancements
1. Insurance claims authorization using consent-gated access.
2. Cross-border identity federation for international portability.
3. AI diagnostics consent controls for model inference governance.
4. Advanced policy semantics (contextual purpose and dynamic risk scoring).

## 18. Open Decisions for Product Steering
1. Which emergency-access policy model is acceptable clinically and legally?
2. How will patient key recovery be handled without weakening sovereignty?
3. What baseline interoperability standard is mandatory first (FHIR profiles, mapping depth)?
4. What SLAs are required per participating institution?
5. Which governance body will operate consortium onboarding and dispute resolution?
