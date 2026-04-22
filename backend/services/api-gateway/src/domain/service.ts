import { AuditEntry, ConsentRecord, Institution, RecordShard } from "../types/models";
import { ciphertextHash, decryptPayload, encryptPayload, makeTokenHash } from "../lib/crypto";
import { makeId } from "../lib/ids";
import { readStore, updateStore } from "../lib/store";
import { hasActiveSubscription, isSubscriptionEnforced } from "../lib/subscription";

export function registerInstitution(input: Omit<Institution, "verified" | "createdAt">): Institution {
  const institution: Institution = {
    ...input,
    verified: true,
    createdAt: new Date().toISOString()
  };

  updateStore((store) => {
    const filtered = store.institutions.filter((item) => item.id !== institution.id);
    return { ...store, institutions: [...filtered, institution] };
  });

  return institution;
}

export function listInstitutions(): Institution[] {
  return readStore().institutions;
}

export function seedDemoData(): void {
  registerInstitution({ id: "hosp-alpha", name: "Alpha General Hospital", country: "IN" });
  registerInstitution({ id: "hosp-beta", name: "Beta Specialist Center", country: "IN" });

  updateStore((state) => {
    const records = state.records.filter(
      (item) => !(item.patientId === "patient-001" && item.createdByInstitutionId === "hosp-alpha" && item.dataType === "radiology")
    );
    const consents = state.consents.filter(
      (item) => !(item.patientId === "patient-001" && item.requesterInstitutionId === "hosp-beta" && item.dataType === "radiology")
    );

    const encrypted = encryptPayload("patient-001", "radiology", "MRI summary: no acute intracranial findings");

    const demoRecord: RecordShard = {
      id: makeId("rec"),
      patientId: "patient-001",
      createdByInstitutionId: "hosp-alpha",
      dataType: "radiology",
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      hash: encrypted.hash,
      createdAt: new Date().toISOString()
    };

    const demoConsent: ConsentRecord = {
      id: makeId("consent"),
      patientId: "patient-001",
      patientWalletAddress: process.env.DEMO_PATIENT_WALLET_ADDRESS ?? "",
      requesterInstitutionId: "hosp-beta",
      dataType: "radiology",
      purpose: "treatment",
      expiryUnixSeconds: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      active: true,
      createdAt: new Date().toISOString()
    };

    return {
      ...state,
      records: [...records, demoRecord],
      consents: [...consents, demoConsent]
    };
  });
}

export function createEncryptedRecord(input: {
  patientId: string;
  createdByInstitutionId: string;
  dataType: string;
  plaintext: string;
}): Omit<RecordShard, "ciphertext" | "iv" | "authTag"> {
  const store = readStore();
  const institution = store.institutions.find((item) => item.id === input.createdByInstitutionId && item.verified);

  if (!institution) {
    throw new Error("Institution is not verified");
  }

  const encrypted = encryptPayload(input.patientId, input.dataType, input.plaintext);

  const shard: RecordShard = {
    id: makeId("rec"),
    patientId: input.patientId,
    createdByInstitutionId: input.createdByInstitutionId,
    dataType: input.dataType,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    hash: encrypted.hash,
    createdAt: new Date().toISOString()
  };

  updateStore((state) => ({ ...state, records: [...state.records, shard] }));

  return {
    id: shard.id,
    patientId: shard.patientId,
    createdByInstitutionId: shard.createdByInstitutionId,
    dataType: shard.dataType,
    hash: shard.hash,
    createdAt: shard.createdAt
  };
}

export function listPatientRecords(patientId: string): Array<Omit<RecordShard, "ciphertext" | "iv" | "authTag">> {
  return readStore()
    .records
    .filter((item) => item.patientId === patientId)
    .map((item) => ({
      id: item.id,
      patientId: item.patientId,
      createdByInstitutionId: item.createdByInstitutionId,
      dataType: item.dataType,
      hash: item.hash,
      createdAt: item.createdAt
    }));
}

export async function grantConsent(input: {
  patientId: string;
  patientWalletAddress: string;
  requesterInstitutionId: string;
  dataType: string;
  purpose: string;
  expiryUnixSeconds: number;
}): Promise<ConsentRecord> {
  const store = readStore();
  const institution = store.institutions.find((item) => item.id === input.requesterInstitutionId && item.verified);

  if (!institution) {
    throw new Error("Requesting institution is not verified");
  }

  const subscribed = await hasActiveSubscription(input.patientWalletAddress);
  if (!subscribed) {
    throw new Error("Active subscription required");
  }

  const consent: ConsentRecord = {
    id: makeId("consent"),
    ...input,
    active: true,
    createdAt: new Date().toISOString()
  };

  updateStore((state) => {
    const existingFiltered = state.consents.filter(
      (item) =>
        !(
          item.patientId === input.patientId &&
          item.requesterInstitutionId === input.requesterInstitutionId &&
          item.dataType === input.dataType
        )
    );
    return { ...state, consents: [...existingFiltered, consent] };
  });

  return consent;
}

export async function revokeConsent(input: {
  patientId: string;
  patientWalletAddress: string;
  requesterInstitutionId: string;
  dataType: string;
}): Promise<ConsentRecord> {
  const store = readStore();
  const found = store.consents.find(
    (item) =>
      item.patientId === input.patientId &&
      item.requesterInstitutionId === input.requesterInstitutionId &&
      item.dataType === input.dataType &&
      item.active
  );

  if (!found) {
    throw new Error("Active consent not found");
  }

  if (found.patientWalletAddress.toLowerCase() !== input.patientWalletAddress.toLowerCase()) {
    throw new Error("Wallet mismatch for consent revocation");
  }

  const subscribed = await hasActiveSubscription(input.patientWalletAddress);
  if (!subscribed) {
    throw new Error("Active subscription required");
  }

  const revoked: ConsentRecord = {
    ...found,
    active: false,
    revokedAt: new Date().toISOString()
  };

  updateStore((state) => ({
    ...state,
    consents: state.consents.map((item) => (item.id === found.id ? revoked : item))
  }));

  return revoked;
}

export function listConsents(patientId?: string): ConsentRecord[] {
  const consents = readStore().consents;
  if (!patientId) {
    return consents;
  }
  return consents.filter((item) => item.patientId === patientId);
}

function appendAudit(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const audit: AuditEntry = {
    id: makeId("audit"),
    timestamp: new Date().toISOString(),
    ...entry
  };

  updateStore((store) => ({ ...store, audits: [...store.audits, audit] }));

  return audit;
}

export function listAudits(filters?: { patientId?: string; requesterInstitutionId?: string }): AuditEntry[] {
  const all = readStore().audits;
  return all.filter((item) => {
    if (filters?.patientId && item.patientId !== filters.patientId) {
      return false;
    }
    if (filters?.requesterInstitutionId && item.requesterInstitutionId !== filters.requesterInstitutionId) {
      return false;
    }
    return true;
  });
}

export async function requestAccess(input: {
  patientId: string;
  requesterInstitutionId: string;
  dataType: string;
  purpose: string;
}): Promise<{
  decision: "GRANT" | "DENY";
  reason: string;
  tokenHash: string;
  audit: AuditEntry;
  plaintext?: string;
  recordId?: string;
}> {
  const store = readStore();
  const now = Math.floor(Date.now() / 1000);

  const institution = store.institutions.find((item) => item.id === input.requesterInstitutionId && item.verified);
  if (!institution) {
    const tokenHash = makeTokenHash([input.patientId, input.requesterInstitutionId, input.dataType, input.purpose, "DENY", "UNVERIFIED_INSTITUTION"]);
    const audit = appendAudit({
      ...input,
      decision: "DENY",
      reason: "UNVERIFIED_INSTITUTION",
      tokenHash
    });
    return { decision: "DENY", reason: "UNVERIFIED_INSTITUTION", tokenHash, audit };
  }

  const consent = store.consents.find(
    (item) =>
      item.patientId === input.patientId &&
      item.requesterInstitutionId === input.requesterInstitutionId &&
      item.dataType === input.dataType
  );

  if (!consent) {
    const tokenHash = makeTokenHash([input.patientId, input.requesterInstitutionId, input.dataType, input.purpose, "DENY", "CONSENT_NOT_FOUND"]);
    const audit = appendAudit({
      ...input,
      decision: "DENY",
      reason: "CONSENT_NOT_FOUND",
      tokenHash
    });
    return { decision: "DENY", reason: "CONSENT_NOT_FOUND", tokenHash, audit };
  }

  if (!consent.active) {
    const tokenHash = makeTokenHash([input.patientId, input.requesterInstitutionId, input.dataType, input.purpose, "DENY", "CONSENT_INACTIVE"]);
    const audit = appendAudit({
      ...input,
      decision: "DENY",
      reason: "CONSENT_INACTIVE",
      tokenHash
    });
    return { decision: "DENY", reason: "CONSENT_INACTIVE", tokenHash, audit };
  }

  if (now > consent.expiryUnixSeconds) {
    const tokenHash = makeTokenHash([input.patientId, input.requesterInstitutionId, input.dataType, input.purpose, "DENY", "CONSENT_EXPIRED"]);
    const audit = appendAudit({
      ...input,
      decision: "DENY",
      reason: "CONSENT_EXPIRED",
      tokenHash
    });
    return { decision: "DENY", reason: "CONSENT_EXPIRED", tokenHash, audit };
  }

  if (consent.purpose !== input.purpose) {
    const tokenHash = makeTokenHash([input.patientId, input.requesterInstitutionId, input.dataType, input.purpose, "DENY", "PURPOSE_MISMATCH"]);
    const audit = appendAudit({
      ...input,
      decision: "DENY",
      reason: "PURPOSE_MISMATCH",
      tokenHash
    });
    return { decision: "DENY", reason: "PURPOSE_MISMATCH", tokenHash, audit };
  }

  if (isSubscriptionEnforced()) {
    const subscribed = await hasActiveSubscription(consent.patientWalletAddress);
    if (!subscribed) {
      const tokenHash = makeTokenHash([
        input.patientId,
        input.requesterInstitutionId,
        input.dataType,
        input.purpose,
        "DENY",
        "SUBSCRIPTION_INACTIVE"
      ]);
      const audit = appendAudit({
        ...input,
        decision: "DENY",
        reason: "SUBSCRIPTION_INACTIVE",
        tokenHash
      });
      return { decision: "DENY", reason: "SUBSCRIPTION_INACTIVE", tokenHash, audit };
    }
  }

  const matchingRecord = [...store.records]
    .reverse()
    .find((item) => item.patientId === input.patientId && item.dataType === input.dataType);

  if (!matchingRecord) {
    const tokenHash = makeTokenHash([input.patientId, input.requesterInstitutionId, input.dataType, input.purpose, "DENY", "RECORD_NOT_FOUND"]);
    const audit = appendAudit({
      ...input,
      decision: "DENY",
      reason: "RECORD_NOT_FOUND",
      tokenHash
    });
    return { decision: "DENY", reason: "RECORD_NOT_FOUND", tokenHash, audit };
  }

  const hashCheck = ciphertextHash(matchingRecord.ciphertext);
  if (hashCheck !== matchingRecord.hash) {
    const tokenHash = makeTokenHash([input.patientId, input.requesterInstitutionId, input.dataType, input.purpose, "DENY", "INTEGRITY_CHECK_FAILED"]);
    const audit = appendAudit({
      ...input,
      decision: "DENY",
      reason: "INTEGRITY_CHECK_FAILED",
      tokenHash
    });
    return { decision: "DENY", reason: "INTEGRITY_CHECK_FAILED", tokenHash, audit };
  }

  const plaintext = decryptPayload(
    matchingRecord.patientId,
    matchingRecord.dataType,
    matchingRecord.ciphertext,
    matchingRecord.iv,
    matchingRecord.authTag
  );

  const tokenHash = makeTokenHash([
    input.patientId,
    input.requesterInstitutionId,
    input.dataType,
    input.purpose,
    "GRANT",
    new Date().toISOString()
  ]);

  const audit = appendAudit({
    ...input,
    decision: "GRANT",
    reason: "AUTHORIZED",
    tokenHash
  });

  return {
    decision: "GRANT",
    reason: "AUTHORIZED",
    tokenHash,
    audit,
    plaintext,
    recordId: matchingRecord.id
  };
}
