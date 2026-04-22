"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, formatUnits, isAddress, parseUnits } from "ethers";

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

type SubscriptionStatus = {
  active: boolean;
  expiry: bigint;
};

type SubscriptionPlan = {
  id: number;
  name: string;
  monthlyPriceSats: bigint;
};

type EthereumWindow = Window & {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  };
};

type WalletError = {
  code?: number;
  message?: string;
};

function cleanEnv(value: string | undefined, fallback = ""): string {
  return (value ?? fallback).trim().replace(/^['\"]|['\"]$/g, "");
}

const API_BASE = cleanEnv(process.env.NEXT_PUBLIC_API_BASE_URL, "http://localhost:4000");
const SUBSCRIPTION_ADDRESS = cleanEnv(process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS);
const WBTC_ADDRESS = cleanEnv(process.env.NEXT_PUBLIC_WBTC_TOKEN_ADDRESS);
const TARGET_CHAIN_HEX = cleanEnv(process.env.NEXT_PUBLIC_CHAIN_HEX, "0x7a69");
const TARGET_CHAIN_NAME = cleanEnv(process.env.NEXT_PUBLIC_CHAIN_NAME, "Hardhat Local");
const TARGET_RPC_URL = cleanEnv(process.env.NEXT_PUBLIC_CHAIN_RPC_URL, "http://127.0.0.1:8545");

const subscriptionAbi = [
  "function subscribe(uint256 planId, uint256 monthsCount) external",
  "function getSubscription(address subscriber) external view returns (bool active, uint256 expiry)",
  "function plans(uint256) external view returns (string memory name, uint256 monthlyPriceSats, bool active)"
];

const erc20Abi = [
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)"
];

const defaultPlans: SubscriptionPlan[] = [
  { id: 1, name: "Basic Monthly", monthlyPriceSats: parseUnits("0.001", 8) },
  { id: 2, name: "Premium Monthly", monthlyPriceSats: parseUnits("0.002", 8) }
];

function normalizeError(error: unknown): string {
  if (!error) {
    return "Unknown wallet error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }

  const candidate = error as {
    message?: string;
    reason?: string;
    shortMessage?: string;
    data?: {
      message?: string;
      originalError?: {
        message?: string;
      };
    };
  };

  return (
    candidate.shortMessage ||
    candidate.reason ||
    candidate.data?.message ||
    candidate.data?.originalError?.message ||
    candidate.message ||
    "Unknown wallet error"
  );
}

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

  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(1);
  const [monthsCount, setMonthsCount] = useState(1);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(defaultPlans);
  const [subscription, setSubscription] = useState<SubscriptionStatus>({ active: false, expiry: 0n });
  const [wbtcBalance, setWbtcBalance] = useState<bigint>(0n);
  const [walletChainId, setWalletChainId] = useState("");

  const activeConsents = useMemo(() => consents.filter((item) => item.active), [consents]);
  const subscriptionRequired = !subscription.active;
  const invalidContractConfig = !isAddress(SUBSCRIPTION_ADDRESS) || !isAddress(WBTC_ADDRESS);
  const walletProviderDetected = mounted && Boolean(getEthereum());

  function getEthereum() {
    return (window as EthereumWindow).ethereum;
  }

  function requireConfiguredContracts() {
    if (invalidContractConfig) {
      throw new Error("Invalid NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS or NEXT_PUBLIC_WBTC_TOKEN_ADDRESS");
    }
  }

  async function ensureTargetNetwork(ethereum: NonNullable<EthereumWindow["ethereum"]>) {
    const currentChain = await ethereum.request({ method: "eth_chainId" }) as string;
    setWalletChainId(currentChain);

    if (currentChain.toLowerCase() === TARGET_CHAIN_HEX.toLowerCase()) {
      return;
    }

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN_HEX }]
      });
      setWalletChainId(TARGET_CHAIN_HEX);
    } catch (error) {
      const walletError = error as WalletError;
      if (walletError.code !== 4902) {
        throw error;
      }

      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: TARGET_CHAIN_HEX,
            chainName: TARGET_CHAIN_NAME,
            rpcUrls: [TARGET_RPC_URL],
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18
            }
          }
        ]
      });
      setWalletChainId(TARGET_CHAIN_HEX);
    }
  }

  async function connectWallet() {
    try {
      const ethereum = getEthereum();
      if (!ethereum) {
        throw new Error("MetaMask not detected");
      }

      const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const account = accounts[0] ?? "";
      if (!account) {
        throw new Error("No wallet account returned");
      }

      const currentChain = await ethereum.request({ method: "eth_chainId" }) as string;
      setWalletChainId(currentChain);

      setWalletAddress(account);
      if (!invalidContractConfig) {
        await loadSubscription(account);
        if (currentChain.toLowerCase() === TARGET_CHAIN_HEX.toLowerCase()) {
          setMessage("Wallet connected");
        } else {
          setMessage(`Wallet connected. Switch to ${TARGET_CHAIN_NAME} (${TARGET_CHAIN_HEX}) to subscribe.`);
        }
      } else {
        setMessage("Wallet connected. Configure subscription contract addresses to continue.");
      }
    } catch (error) {
      setMessage(normalizeError(error));
    }
  }

  async function loadSubscription(address: string) {
    requireConfiguredContracts();
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error("MetaMask not detected");
    }

    const provider = new BrowserProvider(ethereum);
    const subscriptionContract = new Contract(SUBSCRIPTION_ADDRESS, subscriptionAbi, provider);
    const tokenContract = new Contract(WBTC_ADDRESS, erc20Abi, provider);

    const [status, balance, p1, p2] = await Promise.all([
      subscriptionContract.getSubscription(address) as Promise<[boolean, bigint]>,
      tokenContract.balanceOf(address) as Promise<bigint>,
      subscriptionContract.plans(1) as Promise<[string, bigint, boolean]>,
      subscriptionContract.plans(2) as Promise<[string, bigint, boolean]>
    ]);

    setSubscription({ active: status[0], expiry: status[1] });
    setWbtcBalance(balance);

    const nextPlans: SubscriptionPlan[] = [];
    if (p1[2]) {
      nextPlans.push({ id: 1, name: p1[0], monthlyPriceSats: p1[1] });
    }
    if (p2[2]) {
      nextPlans.push({ id: 2, name: p2[0], monthlyPriceSats: p2[1] });
    }

    if (nextPlans.length > 0) {
      setPlans(nextPlans);
      if (!nextPlans.find((item) => item.id === selectedPlanId)) {
        setSelectedPlanId(nextPlans[0].id);
      }
    }
  }

  async function subscribeWithBtc(event: FormEvent) {
    event.preventDefault();

    try {
      requireConfiguredContracts();
      const ethereum = getEthereum();
      if (!ethereum) {
        throw new Error("MetaMask not detected");
      }
      if (!walletAddress) {
        throw new Error("Connect wallet first");
      }

      setSubscriptionLoading(true);
      await ensureTargetNetwork(ethereum);

      const selectedPlan = plans.find((item) => item.id === selectedPlanId);
      if (!selectedPlan) {
        throw new Error("Invalid plan selection");
      }

      const total = selectedPlan.monthlyPriceSats * BigInt(monthsCount);
      if (total <= 0n) {
        throw new Error("Invalid payment amount");
      }
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      const tokenContract = new Contract(WBTC_ADDRESS, erc20Abi, signer);
      const subscriptionContract = new Contract(SUBSCRIPTION_ADDRESS, subscriptionAbi, signer);

      const balance = await tokenContract.balanceOf(signerAddress) as bigint;
      if (balance < total) {
        throw new Error(`Insufficient BTC token balance. Need ${formatUnits(total, 8)} BTC, have ${formatUnits(balance, 8)} BTC`);
      }

      const allowance = await tokenContract.allowance(walletAddress, SUBSCRIPTION_ADDRESS) as bigint;
      if (allowance < total) {
        const approvalTx = await tokenContract.approve(SUBSCRIPTION_ADDRESS, total);
        await approvalTx.wait();
      }

      const subscribeTx = await subscriptionContract.subscribe(selectedPlanId, monthsCount);
      await subscribeTx.wait();

      await loadSubscription(walletAddress);
      setSubscriptionOpen(false);
      setMessage("Subscription payment successful via BTC token");
    } catch (error) {
      setMessage(normalizeError(error));
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function switchNetworkManually() {
    try {
      const ethereum = getEthereum();
      if (!ethereum) {
        throw new Error("MetaMask not detected");
      }

      await ensureTargetNetwork(ethereum);
      setMessage(`Switched to ${TARGET_CHAIN_NAME} (${TARGET_CHAIN_HEX})`);
    } catch (error) {
      setMessage(normalizeError(error));
    }
  }

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

    if (subscriptionRequired) {
      setMessage("Active BTC subscription required before granting consent");
      setSubscriptionOpen(true);
      return;
    }
    if (!walletAddress) {
      setMessage("Connect MetaMask wallet before granting consent");
      setSubscriptionOpen(true);
      return;
    }

    try {
      await apiFetch<{ consent: Consent }>("/consents", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          patientWalletAddress: walletAddress,
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
    if (subscriptionRequired) {
      setMessage("Active BTC subscription required before managing consent");
      setSubscriptionOpen(true);
      return;
    }
    if (!walletAddress) {
      setMessage("Connect MetaMask wallet before revoking consent");
      setSubscriptionOpen(true);
      return;
    }

    try {
      await apiFetch<{ consent: Consent }>("/consents/revoke", {
        method: "POST",
        body: JSON.stringify({
          patientId,
          patientWalletAddress: walletAddress,
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

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const ethereum = getEthereum();
    if (!ethereum) {
      return;
    }

    ethereum.request({ method: "eth_accounts" })
      .then((accountsUnknown) => {
        const accounts = accountsUnknown as string[];
        if (accounts.length > 0) {
          return ethereum.request({ method: "eth_chainId" })
            .then((chainUnknown) => {
              setWalletChainId(chainUnknown as string);
              setWalletAddress(accounts[0]);
              return loadSubscription(accounts[0]);
            });
        }
        return Promise.resolve();
      })
      .catch(() => {
        // ignore silent auto-check failures
      });
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const ethereum = getEthereum();
    if (!ethereum) {
      return;
    }

    ethereum.request({ method: "eth_chainId" })
      .then((chainUnknown) => {
        setWalletChainId(chainUnknown as string);
      })
      .catch(() => {
        // ignore silent chain check failures
      });

    const onChainChanged = (chainId: unknown) => {
      if (typeof chainId === "string") {
        setWalletChainId(chainId);
      }
    };

    const onAccountsChanged = (accountsUnknown: unknown) => {
      const accounts = Array.isArray(accountsUnknown) ? accountsUnknown as string[] : [];
      const nextAccount = accounts[0] ?? "";
      setWalletAddress(nextAccount);
      if (nextAccount && !invalidContractConfig) {
        loadSubscription(nextAccount).catch(() => {
          // ignore silent refresh failures
        });
      }
    };

    ethereum.on?.("chainChanged", onChainChanged);
    ethereum.on?.("accountsChanged", onAccountsChanged);

    return () => {
      ethereum.removeListener?.("chainChanged", onChainChanged);
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, [mounted, invalidContractConfig]);

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
        <button type="button" onClick={() => setSubscriptionOpen(true)}>Manage BTC Subscription</button>
        <p className="hint">Seed Demo recreates the demo patient record, institutions, and consent. Refresh reloads the latest consents, records, and audit trail from the server.</p>
      </section>

      <section className="card">
        <h2>Subscription Status</h2>
        <p>
          Wallet: {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}
        </p>
        <p>
          Status: {subscription.active ? "Active" : "Inactive"}
          {subscription.expiry > 0n ? ` (expires ${new Date(Number(subscription.expiry) * 1000).toLocaleString()})` : ""}
        </p>
        <p>WBTC Balance: {formatUnits(wbtcBalance, 8)} BTC</p>
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
        {subscriptionRequired && (
          <p className="warning">An active BTC subscription is required to grant or revoke consent.</p>
        )}
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

      {subscriptionOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h2>Subscribe Using Bitcoin on MetaMask</h2>
            <p>
              Payment is processed using BTC-compatible ERC-20 token (for example WBTC/mBTC) through MetaMask.
            </p>
            <p className="hint">
              Required chain: {TARGET_CHAIN_NAME} ({TARGET_CHAIN_HEX}). Current chain: {walletChainId || (walletProviderDetected ? "Not connected" : "MetaMask provider not detected")}
            </p>
            {!walletProviderDetected && (
              <p className="warning">
                MetaMask is not available in this browser context. Open the patient portal in a normal browser profile where MetaMask extension is installed and unlocked.
              </p>
            )}
            <p className="hint">
              Runtime config: subscription {isAddress(SUBSCRIPTION_ADDRESS) ? "ok" : "invalid"} ({SUBSCRIPTION_ADDRESS || "empty"}),
              token {isAddress(WBTC_ADDRESS) ? "ok" : "invalid"} ({WBTC_ADDRESS || "empty"})
            </p>
            {invalidContractConfig && (
              <p className="warning">
                Invalid contract configuration. Set NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS and NEXT_PUBLIC_WBTC_TOKEN_ADDRESS.
              </p>
            )}

            {!walletAddress ? (
              <button type="button" onClick={connectWallet}>Connect MetaMask</button>
            ) : (
              <p>Connected: {walletAddress}</p>
            )}

            <button type="button" onClick={switchNetworkManually} disabled={!getEthereum()}>
              Switch Network
            </button>

            <form className="grid" onSubmit={subscribeWithBtc}>
              <label>
                Plan
                <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(Number(event.target.value))}>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {formatUnits(plan.monthlyPriceSats, 8)} BTC / month
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Months
                <input
                  type="number"
                  min={1}
                  value={monthsCount}
                  onChange={(event) => setMonthsCount(Number(event.target.value) || 1)}
                />
              </label>

              <button type="submit" disabled={subscriptionLoading || !walletAddress || invalidContractConfig}>
                {subscriptionLoading ? "Processing..." : "Approve & Subscribe"}
              </button>
              <button type="button" onClick={() => setSubscriptionOpen(false)} disabled={subscriptionLoading}>
                Close
              </button>
            </form>
          </div>
        </div>
      )}

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
