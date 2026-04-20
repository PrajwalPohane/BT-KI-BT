"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Institution = {
  id: string;
  name: string;
  country: string;
  verified: boolean;
};

type Consent = {
  id: string;
  patientId: string;
  requesterInstitutionId: string;
  dataType: string;
  purpose: string;
  expiryUnixSeconds: number;
  active: boolean;
  createdAt: string;
  revokedAt?: string;
};

type RecordItem = {
  id: string;
  patientId: string;
  createdByInstitutionId: string;
  dataType: string;
  hash: string;
  createdAt: string;
};

type Audit = {
  id: string;
  patientId: string;
  requesterInstitutionId: string;
  dataType: string;
  purpose: string;
  decision: "GRANT" | "DENY";
  reason: string;
  tokenHash: string;
  timestamp: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export default function PatientPortalHome() {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<string>("Ready");
  const [patientId, setPatientId] = useState("patient-001");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);

  const [institutionId, setInstitutionId] = useState("hosp-beta");
  const [dataType, setDataType] = useState("radiology");
  const [purpose, setPurpose] = useState("treatment");
  const [expiryHours, setExpiryHours] = useState(24);

  const activeConsents = useMemo(() => consents.filter((item) => item.active), [consents]);

  async function loadAll(currentPatientId: string) {
    const [instRes, consentRes, recordsRes, auditsRes] = await Promise.all([
      apiFetch<{ institutions: Institution[] }>("/registry/institutions"),
      apiFetch<{ consents: Consent[] }>(`/consents?patientId=${encodeURIComponent(currentPatientId)}`),
      apiFetch<{ records: RecordItem[] }>(`/records/${encodeURIComponent(currentPatientId)}`),
      apiFetch<{ audits: Audit[] }>(`/audit?patientId=${encodeURIComponent(currentPatientId)}`)
    ]);

    setInstitutions(instRes.institutions);
    setConsents(consentRes.consents);
    setRecords(recordsRes.records);
    setAudits(auditsRes.audits);
  }

  async function seed() {
    try {
      await apiFetch<{ ok: boolean }>("/seed", { method: "POST" });
      await loadAll(patientId);
      setMessage("Seeded demo data");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seed failed");
    }
  }

  async function onGrantConsent(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch<{ consent: Consent }>("/consents", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          requesterInstitutionId: institutionId,
          dataType,
          purpose,
          expiryUnixSeconds: Math.floor(Date.now() / 1000) + expiryHours * 60 * 60
        })
      });
      await loadAll(patientId);
      setMessage("Consent granted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Consent grant failed");
    }
  }

  async function onRevokeConsent(requesterInstitutionId: string, consentDataType: string) {
    try {
      await apiFetch<{ consent: Consent }>("/consents/revoke", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          requesterInstitutionId,
          dataType: consentDataType
        })
      });
      await loadAll(patientId);
      setMessage("Consent revoked");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Consent revoke failed");
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    loadAll(patientId).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Load failed");
    });
  }, [mounted, patientId]);

  if (!mounted) {
    return (
      <main className="container" suppressHydrationWarning>
        <header className="hero">
          <h1>BlockMedShare Patient Portal</h1>
          <p>Loading secure workspace...</p>
        </header>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="hero">
        <h1>BlockMedShare Patient Portal</h1>
        <p>Grant and revoke data sharing consent with full audit transparency.</p>
      </header>

      <section className="card row">
        <label>
          Patient ID
          <input value={patientId} onChange={(event) => setPatientId(event.target.value)} />
        </label>
        <button type="button" onClick={seed}>Seed Demo</button>
        <button type="button" onClick={() => loadAll(patientId)}>Refresh</button>
        <p className="hint">Seed Demo recreates the demo patient record, institutions, and consent. Refresh reloads the latest consents, records, and audit trail from the server.</p>
      </section>

      <section className="card">
        <h2>Grant Consent</h2>
        <form className="grid" onSubmit={onGrantConsent}>
          <label>
            Institution
            <select value={institutionId} onChange={(event) => setInstitutionId(event.target.value)}>
              {institutions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Data Type
            <input value={dataType} onChange={(event) => setDataType(event.target.value)} />
          </label>
          <label>
            Purpose
            <input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
          </label>
          <label>
            Expiry (hours)
            <input
              type="number"
              min={1}
              value={expiryHours}
              onChange={(event) => setExpiryHours(Number(event.target.value) || 1)}
            />
          </label>
          <button type="submit">Grant</button>
        </form>
      </section>

      <section className="card">
        <h2>Active Consents</h2>
        <ul className="list">
          {activeConsents.map((item) => (
            <li key={item.id}>
              <span>
                {item.requesterInstitutionId} | {item.dataType} | {item.purpose} | expires {new Date(item.expiryUnixSeconds * 1000).toLocaleString()}
              </span>
              <button type="button" onClick={() => onRevokeConsent(item.requesterInstitutionId, item.dataType)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Patient Records (Encrypted Off-chain Metadata)</h2>
        <ul className="list">
          {records.map((item) => (
            <li key={item.id}>
              {item.dataType} | created by {item.createdByInstitutionId} | hash {item.hash.slice(0, 16)}...
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Audit Trail</h2>
        <ul className="list">
          {audits.map((item) => (
            <li key={item.id}>
              {item.timestamp} | {item.requesterInstitutionId} | {item.dataType} | {item.purpose} | {item.decision} ({item.reason})
            </li>
          ))}
        </ul>
      </section>

      <p className="status">Status: {message}</p>
    </main>
  );
}
