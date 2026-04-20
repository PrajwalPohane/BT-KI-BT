export type AccessDecision = "GRANT" | "DENY";

export interface Institution {
  id: string;
  name: string;
  country: string;
  verified: boolean;
  createdAt: string;
}

export interface RecordShard {
  id: string;
  patientId: string;
  createdByInstitutionId: string;
  dataType: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  hash: string;
  createdAt: string;
}

export interface ConsentRecord {
  id: string;
  patientId: string;
  requesterInstitutionId: string;
  dataType: string;
  purpose: string;
  expiryUnixSeconds: number;
  active: boolean;
  createdAt: string;
  revokedAt?: string;
}

export interface AuditEntry {
  id: string;
  patientId: string;
  requesterInstitutionId: string;
  dataType: string;
  purpose: string;
  decision: AccessDecision;
  reason: string;
  tokenHash: string;
  timestamp: string;
}

export interface DataStore {
  institutions: Institution[];
  records: RecordShard[];
  consents: ConsentRecord[];
  audits: AuditEntry[];
}
