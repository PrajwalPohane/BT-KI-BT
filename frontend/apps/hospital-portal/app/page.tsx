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

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "patient" | "hospital";
  createdAt: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const HOSPITAL_AUTH_STORAGE_KEY = "blockmedshare.auth.hospital";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: string };
      throw new Error(parsed.error || text || `Request failed: ${response.status}`);
    } catch {
      throw new Error(text || `Request failed: ${response.status}`);
    }
  }

  return response.json() as Promise<T>;
}

export default function HospitalPortalHome() {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authLoading, setAuthLoading] = useState(false);
  const [authName, setAuthName] = useState("Hospital User");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);

  const [patientId, setPatientId] = useState("patient-001");
  const [requesterInstitutionId, setRequesterInstitutionId] =
    useState("hosp-beta");
  const [dataType, setDataType] = useState("radiology");
  const [purpose, setPurpose] = useState("treatment");

  const [response, setResponse] = useState<AccessResponse | null>(null);

  const [newInstitutionId, setNewInstitutionId] = useState("hosp-gamma");
  const [newInstitutionName, setNewInstitutionName] =
    useState("Gamma Care Network");
  const [newInstitutionCountry, setNewInstitutionCountry] = useState("IN");

  const summaryCards = [
    {
      label: "Institutions",
      value: institutions.length.toString().padStart(2, "0"),
      tone: "mint",
    },
    {
      label: "Audits",
      value: audits.length.toString().padStart(2, "0"),
      tone: "sky",
    },
    {
      label: "Decision",
      value: response ? response.decision : "--",
      tone: response?.decision === "GRANT" ? "mint" : response?.decision === "DENY" ? "amber" : "neutral",
    },
  ];

  const requestSummary = `${requesterInstitutionId} / ${patientId} / ${dataType}`;

  function saveAuthSession(token: string, user: AuthUser) {
    setAuthToken(token);
    setAuthUser(user);
    localStorage.setItem(
      HOSPITAL_AUTH_STORAGE_KEY,
      JSON.stringify({ token, user }),
    );
  }

  function clearAuthSession() {
    setAuthToken("");
    setAuthUser(null);
    localStorage.removeItem(HOSPITAL_AUTH_STORAGE_KEY);
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setAuthLoading(true);

    try {
      const path = authMode === "signup" ? "/auth/signup" : "/auth/signin";
      const payload =
        authMode === "signup"
          ? {
              name: authName,
              email: authEmail,
              password: authPassword,
              role: "hospital",
            }
          : { email: authEmail, password: authPassword, role: "hospital" };

      const result = await apiFetch<{ token: string; user: AuthUser }>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      saveAuthSession(result.token, result.user);
      setMessage("Signed in");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Authentication failed",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function signOut() {
    clearAuthSession();
    setMessage("Signed out");
  }

  async function loadData() {
    const [instRes, auditRes] = await Promise.all([
      apiFetch<{ institutions: Institution[] }>("/registry/institutions"),
      apiFetch<{ audits: Audit[] }>(
        `/audit?requesterInstitutionId=${encodeURIComponent(requesterInstitutionId)}`,
      ),
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
          country: newInstitutionCountry,
        }),
      });
      await loadData();
      setRequesterInstitutionId(newInstitutionId);
      setMessage("Institution registered");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Registration failed",
      );
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
          purpose,
        }),
      });
      setResponse(result);
      await loadData();
      setMessage(`Access decision: ${result.decision}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Access request failed",
      );
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const raw = localStorage.getItem(HOSPITAL_AUTH_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { token?: string; user?: AuthUser };
      if (!parsed.token || !parsed.user || parsed.user.role !== "hospital") {
        clearAuthSession();
        return;
      }

      apiFetch<{ user: AuthUser }>("/auth/me", {
        headers: {
          Authorization: `Bearer ${parsed.token}`,
        },
      })
        .then((response) => {
          saveAuthSession(parsed.token as string, response.user);
        })
        .catch(() => {
          clearAuthSession();
          setMessage("Session expired. Please sign in again.");
        });
    } catch {
      clearAuthSession();
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !authUser) {
      return;
    }

    loadData().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Load failed");
    });
  }, [mounted, requesterInstitutionId, authUser]);

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

  if (!authUser) {
    return (
      <main className="container">
        <header className="hero">
          <h1>BlockMedShare Hospital Portal</h1>
          <p>Sign in to access hospital workflows.</p>
        </header>

        <section className="card">
          <h2>
            {authMode === "signin" ? "Hospital Sign In" : "Hospital Sign Up"}
          </h2>
          <form className="grid" onSubmit={handleAuth}>
            {authMode === "signup" && (
              <label>
                Full Name
                <input
                  value={authName}
                  onChange={(event) => setAuthName(event.target.value)}
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </label>
            <button type="submit" disabled={authLoading}>
              {authLoading
                ? "Please wait..."
                : authMode === "signin"
                  ? "Sign In"
                  : "Sign Up"}
            </button>
          </form>
          <button
            type="button"
            onClick={() =>
              setAuthMode(authMode === "signin" ? "signup" : "signin")
            }
          >
            {authMode === "signin"
              ? "Need an account? Sign Up"
              : "Already have an account? Sign In"}
          </button>
        </section>

        <p className="status">Status: {message}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="hero">
        <div className="heroBadge">Hospital workflow live</div>
        <h1>BlockMedShare Hospital Portal</h1>
        <p>
          Submit consent-aware cross-institution access requests and inspect
          audit records.
        </p>
        <p>
          Signed in as {authUser.name} ({authUser.email})
        </p>
        <div className="statusCluster">
          <span className="statusChip statusChip--info">Requester {requesterInstitutionId}</span>
          <span className="statusChip statusChip--neutral">Patient {patientId}</span>
          <span className="statusChip statusChip--success">{authUser.role}</span>
        </div>
      </header>

      <section className="card row">
        <button type="button" onClick={signOut}>
          Sign Out
        </button>
      </section>

      <section className="card row">
        <button type="button" onClick={seed}>
          Seed Demo
        </button>
        <button type="button" onClick={loadData}>
          Refresh
        </button>
        <p className="hint">
          Seed Demo recreates the verified demo hospitals, a sample record, and
          a matching consent. Refresh reloads the latest server state.
        </p>
      </section>

      <section className="summaryGrid">
        {summaryCards.map((item) => (
          <article key={item.label} className={`summaryCard summaryCard--${item.tone}`}>
            <span className="summaryLabel">{item.label}</span>
            <strong className="summaryValue">{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>Register Institution</h2>
        <p className="hint">Create or overwrite a verified hospital identity in the demo registry.</p>
        <form className="grid" onSubmit={registerInstitution}>
          <label>
            ID
            <input
              value={newInstitutionId}
              onChange={(event) => setNewInstitutionId(event.target.value)}
            />
          </label>
          <label>
            Name
            <input
              value={newInstitutionName}
              onChange={(event) => setNewInstitutionName(event.target.value)}
            />
          </label>
          <label>
            Country
            <input
              value={newInstitutionCountry}
              onChange={(event) => setNewInstitutionCountry(event.target.value)}
            />
          </label>
          <button type="submit">Register</button>
        </form>
      </section>

      <section className="card">
        <h2>Access Request</h2>
        <p className="hint">Current request: {requestSummary}</p>
        <form className="grid" onSubmit={requestAccess}>
          <label>
            Requester Institution
            <select
              value={requesterInstitutionId}
              onChange={(event) =>
                setRequesterInstitutionId(event.target.value)
              }
            >
              {institutions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Patient ID
            <input
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
            />
          </label>
          <label>
            Data Type
            <input
              value={dataType}
              onChange={(event) => setDataType(event.target.value)}
            />
          </label>
          <label>
            Purpose
            <input
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
            />
          </label>
          <button type="submit">Request Access</button>
        </form>
      </section>

      {response && (
        <section className="card">
          <h2>Last Decision</h2>
          <div className="statusGrid">
            <div>
              <span className="eyebrow">Decision</span>
              <p>{response.decision}</p>
            </div>
            <div>
              <span className="eyebrow">Reason</span>
              <p>{response.reason}</p>
            </div>
            <div>
              <span className="eyebrow">Token</span>
              <p>{response.tokenHash.slice(0, 16)}...</p>
            </div>
          </div>
          {response.plaintext && <p>Decrypted Payload: {response.plaintext}</p>}
        </section>
      )}

      <section className="card">
        <h2>Audit Entries</h2>
        <p className="hint">Use refresh to pull the latest audit trail after each access request.</p>
        <ul className="list">
          {audits.map((item) => (
            <li key={item.id}>
              {item.timestamp} | {item.patientId} | {item.dataType} |{" "}
              {item.purpose} | {item.decision} ({item.reason})
            </li>
          ))}
        </ul>
      </section>

      <p className="status">Status: {message}</p>
    </main>
  );
}
