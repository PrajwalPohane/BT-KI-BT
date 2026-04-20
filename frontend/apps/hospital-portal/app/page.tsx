"use client";

import { FormEvent, useEffect, useState } from "react";

type Institution = {
  id: string;
  name: string;
  country: string;
  verified: boolean;
};

type AccessResponse = {
  decision: "GRANT" | "DENY";
  reason: string;
  tokenHash: string;
  plaintext?: string;
  recordId?: string;
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

export default function HospitalPortalHome() {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);

  const [patientId, setPatientId] = useState("patient-001");
  const [requesterInstitutionId, setRequesterInstitutionId] = useState("hosp-beta");
  const [dataType, setDataType] = useState("radiology");
  const [purpose, setPurpose] = useState("treatment");

  const [response, setResponse] = useState<AccessResponse | null>(null);

  const [newInstitutionId, setNewInstitutionId] = useState("hosp-gamma");
  const [newInstitutionName, setNewInstitutionName] = useState("Gamma Care Network");
  const [newInstitutionCountry, setNewInstitutionCountry] = useState("IN");

  async function loadData() {
    const [instRes, auditRes] = await Promise.all([
      apiFetch<{ institutions: Institution[] }>("/registry/institutions"),
      apiFetch<{ audits: Audit[] }>(`/audit?requesterInstitutionId=${encodeURIComponent(requesterInstitutionId)}`)
    ]);

    setInstitutions(instRes.institutions);
    setAudits(auditRes.audits);
  }

  async function seed() {
    try {
      await apiFetch<{ ok: boolean }>("/seed", { method: "POST" });
      await loadData();
      setMessage("Seeded demo data");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seed failed");
    }
  }

  async function registerInstitution(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch("/registry/institutions", {
        method: "POST",
        body: JSON.stringify({
          id: newInstitutionId,
          name: newInstitutionName,
          country: newInstitutionCountry
        })
      });
      await loadData();
      setRequesterInstitutionId(newInstitutionId);
      setMessage("Institution registered");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed");
    }
  }

  async function requestAccess(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await apiFetch<AccessResponse>("/access/request", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          requesterInstitutionId,
          dataType,
          purpose
        })
      });
      setResponse(result);
      await loadData();
      setMessage(`Access decision: ${result.decision}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access request failed");
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    loadData().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Load failed");
    });
  }, [mounted, requesterInstitutionId]);

  if (!mounted) {
    return (
      <main className="container" suppressHydrationWarning>
        <header className="hero">
          <h1>BlockMedShare Hospital Portal</h1>
          <p>Loading secure workspace...</p>
        </header>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="hero">
        <h1>BlockMedShare Hospital Portal</h1>
        <p>Submit consent-aware cross-institution access requests and inspect audit records.</p>
      </header>

      <section className="card row">
        <button type="button" onClick={seed}>Seed Demo</button>
        <button type="button" onClick={loadData}>Refresh</button>
        <p className="hint">Seed Demo recreates the verified demo hospitals, a sample record, and a matching consent. Refresh reloads the latest server state.</p>
      </section>

      <section className="card">
        <h2>Register Institution</h2>
        <form className="grid" onSubmit={registerInstitution}>
          <label>
            ID
            <input value={newInstitutionId} onChange={(event) => setNewInstitutionId(event.target.value)} />
          </label>
          <label>
            Name
            <input value={newInstitutionName} onChange={(event) => setNewInstitutionName(event.target.value)} />
          </label>
          <label>
            Country
            <input value={newInstitutionCountry} onChange={(event) => setNewInstitutionCountry(event.target.value)} />
          </label>
          <button type="submit">Register</button>
        </form>
      </section>

      <section className="card">
        <h2>Access Request</h2>
        <form className="grid" onSubmit={requestAccess}>
          <label>
            Requester Institution
            <select value={requesterInstitutionId} onChange={(event) => setRequesterInstitutionId(event.target.value)}>
              {institutions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Patient ID
            <input value={patientId} onChange={(event) => setPatientId(event.target.value)} />
          </label>
          <label>
            Data Type
            <input value={dataType} onChange={(event) => setDataType(event.target.value)} />
          </label>
          <label>
            Purpose
            <input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
          </label>
          <button type="submit">Request Access</button>
        </form>
      </section>

      {response && (
        <section className="card">
          <h2>Last Decision</h2>
          <p>Decision: {response.decision}</p>
          <p>Reason: {response.reason}</p>
          <p>Token Hash: {response.tokenHash}</p>
          {response.plaintext && <p>Decrypted Payload: {response.plaintext}</p>}
        </section>
      )}

      <section className="card">
        <h2>Audit Entries</h2>
        <ul className="list">
          {audits.map((item) => (
            <li key={item.id}>
              {item.timestamp} | {item.patientId} | {item.dataType} | {item.purpose} | {item.decision} ({item.reason})
            </li>
          ))}
        </ul>
      </section>

      <p className="status">Status: {message}</p>
    </main>
  );
}
