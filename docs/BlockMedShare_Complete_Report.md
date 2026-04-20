# BlockMedShare Project Report

BlockMedShare is a healthcare data-sharing platform built to let patients control who can access their medical records, while hospitals can request data in a secure and auditable way. The core idea is simple: medical data stays encrypted off-chain, and the blockchain stores consent, access control decisions, and audit records so that every action is traceable and tamper-resistant.

The implementation is split into two main product surfaces and one governance layer:
- Frontend for patients and hospitals in [frontend/apps/patient-portal](frontend/apps/patient-portal) and [frontend/apps/hospital-portal](frontend/apps/hospital-portal)
- Backend API and data logic in [backend/services/api-gateway](backend/services/api-gateway)
- Blockchain contracts and tests in [backend/blockchain](backend/blockchain)

## 1. Why this project is needed

Healthcare systems usually keep records inside separate hospitals. That creates several problems:
- Doctors may not have the full medical history when treating a patient.
- Patients often do not know who accessed their data.
- Sharing records between institutions is slow and manual.
- Centralized systems create a single point of failure.
- Compliance with privacy laws is hard when access is not fully traceable.

BlockMedShare is meant to solve these issues by making consent explicit, access controlled, and every request auditable.

## 2. Simple explanation of how it works

At a high level:
- A patient grants consent to a hospital for a specific data type and purpose.
- A hospital requests access to that patient’s data.
- The system checks whether consent exists, is active, not expired, and matches the purpose.
- If allowed, the record is decrypted and returned.
- Every decision is written to the audit trail.
- The patient can later see what happened and revoke consent.

The workflow is visible in the code across:
- API logic: [backend/services/api-gateway/src/domain/service.ts](backend/services/api-gateway/src/domain/service.ts)
- Patient UI: [frontend/apps/patient-portal/app/page.tsx](frontend/apps/patient-portal/app/page.tsx)
- Hospital UI: [frontend/apps/hospital-portal/app/page.tsx](frontend/apps/hospital-portal/app/page.tsx)
- Contracts: [backend/blockchain/contracts](backend/blockchain/contracts)

## 3. System architecture

The system has four major layers:

1. Frontend layer
- Patient portal: manages consent, shows records, shows audit trail.
- Hospital portal: registers institutions, submits access requests, views decisions.

2. Backend layer
- Stores institutions, records, consents, and audits.
- Encrypts and decrypts patient payloads.
- Validates requests and produces grant/deny outcomes.

3. Blockchain layer
- Models consent, audit logging, registry governance, and request enforcement.
- Provides immutable-style recordkeeping and trust boundaries.

4. Storage layer
- Medical content is encrypted before storage.
- Only metadata and hashes are exposed to the system logic.

## 4. Major implementation idea

The backend currently acts as the operational engine for the workflow. It uses:
- a file-backed store for local MVP persistence
- AES-256-GCM for encryption
- HKDF for key derivation
- SHA-256 for integrity hashing
- structured audit records for transparency

The blockchain layer models the same trust rules with smart contracts:
- consent storage
- access verification
- audit logging
- consortium registry checks

## 5. Workflow of the project

This is the most important part.

### Step 1: Seed demo data
The seed action prepares a working demo state:
- registers demo hospitals
- creates a sample encrypted radiology record
- creates a matching consent for a known patient/hospital pair

In the UI:
- Seed Demo = creates or recreates the demo fixture
- Refresh = reloads the latest server state

The seed route is in [backend/services/api-gateway/src/routes/seed.ts](backend/services/api-gateway/src/routes/seed.ts).

### Step 2: Institution onboarding
Before a hospital can access records, it must be a verified institution.

In the hospital portal, the user can register a hospital. The backend marks it as verified and stores it in the registry.
- Registry UI and API flow: [backend/services/api-gateway/src/routes/registry.ts](backend/services/api-gateway/src/routes/registry.ts)

### Step 3: Consent grant
A patient chooses:
- which hospital
- what data type
- what purpose
- when the permission expires

That consent is stored and becomes the basis for later access decisions.
- Consent flow: [backend/services/api-gateway/src/routes/consents.ts](backend/services/api-gateway/src/routes/consents.ts)

### Step 4: Access request
A hospital submits a request with:
- patient ID
- requester institution ID
- data type
- purpose

The backend then checks:
- is the institution verified?
- does consent exist?
- is consent active?
- has it expired?
- does purpose match?
- is the data integrity valid?

This is implemented in:
- [backend/services/api-gateway/src/domain/service.ts](backend/services/api-gateway/src/domain/service.ts)
- [backend/services/api-gateway/src/routes/access.ts](backend/services/api-gateway/src/routes/access.ts)

### Step 5: Grant or deny
If all checks pass:
- the request is granted
- the encrypted data is decrypted
- the plaintext is returned to the requester
- an audit record is written

If any check fails:
- the request is denied
- the reason is recorded
- the denial is also audited

### Step 6: Audit trail
Every access attempt is stored as an audit entry.
That includes both grants and denials, which is important because even failed access attempts are security-relevant.

This is visible in:
- [backend/services/api-gateway/src/routes/audit.ts](backend/services/api-gateway/src/routes/audit.ts)

### Step 7: Patient review
The patient portal shows:
- active consents
- stored records
- audit history

The patient can revoke consent at any time.
That revocation immediately affects future access requests.

## 6. Blockchain concepts used in the project

Here is every major blockchain concept used, explained simply.

### 6.1 Smart contracts
Smart contracts are programs deployed on a blockchain that execute predefined rules automatically.

In this project:
- [ConsentContract.sol](backend/blockchain/contracts/ConsentContract.sol) stores patient consent
- [AccessControlContract.sol](backend/blockchain/contracts/AccessControlContract.sol) decides whether access should be granted
- [AuditLogContract.sol](backend/blockchain/contracts/AuditLogContract.sol) writes audit entries
- [ConsortiumRegistry.sol](backend/blockchain/contracts/ConsortiumRegistry.sol) manages trusted institutions

Why it matters:
- no one can silently change the rules after deployment
- access control is enforced consistently
- rules are transparent

### 6.2 Permissioned consortium blockchain
This is not an open public chain where anyone can join. It is a controlled network where only approved institutions participate.

In the project:
- only verified hospitals can be part of the registry
- access requests from non-verified institutions are rejected

Why it matters:
- reduces fake institution attacks
- fits healthcare governance better than a fully open network

### 6.3 Ethereum compatibility
The contracts are written in Solidity and designed for Ethereum-style execution.

In the project:
- contracts use standard Solidity patterns
- Hardhat is used for compilation and testing
- Ethereum-like addresses and contract calls are used

Why it matters:
- easier development and testing
- common tooling support
- familiar smart contract model

### 6.4 Addresses
An address is the identifier used for wallets, patients, hospitals, and contract accounts.

In the project:
- patient and hospital identities are tied to addresses in the contract model
- consent records reference patient and hospital addresses

Why it matters:
- addresses are how blockchain systems know who is acting

### 6.5 Transactions
A transaction is a signed action sent to the blockchain.

In the project:
- granting consent is a transaction
- revoking consent is a transaction
- requesting access is a transaction

Why it matters:
- transactions create a permanent, ordered record
- they are signed and attributable

### 6.6 Immutability
Immutability means that once a blockchain record is written, it is extremely hard to alter.

In the project:
- audit logs are intended to be permanent
- consent changes are recorded as state updates, not hidden edits

Why it matters:
- gives a trustworthy history
- helps with compliance and forensic review

### 6.7 Audit trail
An audit trail is a history of actions taken on the system.

In the project:
- every access grant or deny is logged
- logs include patient, requester, data type, purpose, decision, token hash, and timestamp

Why it matters:
- patients can review access history
- compliance teams can investigate incidents
- unauthorized attempts are visible

### 6.8 Access control
Access control is the logic that decides who can see what.

In the project:
- consent must exist
- consent must be active
- consent must not be expired
- purpose must match
- institution must be verified

Why it matters:
- prevents unauthorized access
- enforces patient choice

### 6.9 Revocation
Revocation means a patient can withdraw permission.

In the project:
- consent can be revoked from the patient portal
- after revocation, future requests fail

Why it matters:
- gives patients ongoing control
- prevents stale permissions from staying active forever

### 6.10 Hashing
Hashing converts data into a fixed-length fingerprint.

In the project:
- SHA-256 is used to verify ciphertext integrity
- token hashes are used in audit records

Why it matters:
- detects tampering
- creates stable fingerprints without exposing raw content

### 6.11 Off-chain storage
Off-chain means the actual medical record is stored outside the blockchain.

In the project:
- medical payloads are encrypted and stored in the backend data layer
- only hashes and metadata are tracked in the system

Why it matters:
- avoids putting sensitive medical content directly on-chain
- keeps the blockchain lightweight
- helps with privacy and storage efficiency

### 6.12 Encryption
Encryption turns readable data into unreadable ciphertext unless the key is known.

In the project:
- medical records use AES-256-GCM
- encryption happens before storage
- decryption only happens after access is approved

Why it matters:
- protects privacy
- prevents exposure if storage is compromised

### 6.13 AES-256-GCM
AES-256-GCM is a strong encryption standard with authenticated integrity.

In the project:
- it encrypts patient records
- it also ensures ciphertext has not been modified

Why it matters:
- confidentiality plus integrity in one mode

### 6.14 HKDF
HKDF is a key derivation function that creates cryptographic keys from a master secret.

In the project:
- the backend derives record-specific encryption keys using patient ID and data type

Why it matters:
- avoids using the same raw key everywhere
- gives stronger key separation

### 6.15 Events
Events are emitted by contracts to signal that something happened.

In the project:
- consent granted/revoked
- access logged
- institution registered/revoked

Why it matters:
- makes it easy to track actions
- supports monitoring and listener services

### 6.16 Consortium registry
This is the trusted list of hospitals allowed to participate.

In the project:
- [ConsortiumRegistry.sol](backend/blockchain/contracts/ConsortiumRegistry.sol) tracks verified institutions
- access is rejected if the requester is not verified

Why it matters:
- stops rogue institutions from joining
- adds governance to the network

### 6.17 Big picture relationship between blockchain and backend
In the current implementation:
- the backend is the working MVP engine
- the blockchain contracts model and enforce the same rules in a decentralized trust layer
- the event listener is ready to track and report audit activity

So the project is structured to evolve from local MVP logic into deeper on-chain integration without changing the product concept.

## 7. What each portal does

### Patient portal
Location: [frontend/apps/patient-portal/app/page.tsx](frontend/apps/patient-portal/app/page.tsx)

Functions:
- sets and revokes consent
- shows active consents
- shows patient record metadata
- shows audit history
- uses Seed Demo and Refresh

### Hospital portal
Location: [frontend/apps/hospital-portal/app/page.tsx](frontend/apps/hospital-portal/app/page.tsx)

Functions:
- registers an institution
- submits access requests
- sees grant/deny decision
- views audit records
- uses Seed Demo and Refresh

## 8. Seed and refresh explained simply

### Seed Demo
This prepares the demo state so the app can be tested immediately.

It creates:
- verified demo hospitals
- a sample patient record
- a matching consent record

Without seed, a first access request may fail because the prerequisite data is missing.

### Refresh
This reloads the latest server-side data into the UI.

It does not create anything new. It only pulls the latest:
- institutions
- consents
- records
- audits

## 9. Why the project is designed this way

This design balances:
- privacy
- control
- traceability
- operational practicality

If you put everything on-chain, privacy becomes difficult.  
If you keep everything in a normal database, trust and auditability become weak.  
BlockMedShare splits the problem:
- sensitive content stays encrypted off-chain
- trust rules, consent state, and auditability stay controlled and transparent

## 10. Practical strengths of the current implementation

- Clear patient control over consent
- Verified institutions only
- Full audit trail for every access request
- Separate patient and hospital interfaces
- Strong cryptographic handling of data at rest
- Blockchain contracts that model governance and enforcement rules

## 11. Limits and next natural improvements

The current implementation is a solid MVP, but the next stage would usually add:
- real database persistence like Postgres
- wallet-based authentication
- direct contract-event sync into the backend
- stronger deployment and production monitoring
- FHIR/EHR integration adapters

## 12. Final summary

BlockMedShare is a patient-first healthcare interoperability platform. The patient controls access, the hospital requests access, the system checks consent and purpose, the data stays encrypted, and every action is audited. The blockchain part gives the project its trust and governance model, while the backend and frontends make it usable in practice.
