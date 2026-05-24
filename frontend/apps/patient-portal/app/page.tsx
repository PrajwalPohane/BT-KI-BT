"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  formatUnits,
  isAddress,
  parseUnits,
} from "ethers";

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
    removeListener?: (
      event: string,
      handler: (...args: unknown[]) => void,
    ) => void;
  };
};

type WalletError = {
  code?: number;
  message?: string;
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "patient" | "hospital";
  createdAt: string;
};

function cleanEnv(value: string | undefined, fallback = ""): string {
  return (value ?? fallback).trim().replace(/^['\"]|['\"]$/g, "");
}

const API_BASE = cleanEnv(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  "http://localhost:4000",
);
const PATIENT_AUTH_STORAGE_KEY = "blockmedshare.auth.patient";
const SUBSCRIPTION_ADDRESS = cleanEnv(
  process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS,
);
const WBTC_ADDRESS = cleanEnv(process.env.NEXT_PUBLIC_WBTC_TOKEN_ADDRESS);
const TARGET_CHAIN_HEX = cleanEnv(process.env.NEXT_PUBLIC_CHAIN_HEX, "0x7a69");
const TARGET_CHAIN_NAME = cleanEnv(
  process.env.NEXT_PUBLIC_CHAIN_NAME,
  "Hardhat Local",
);
const TARGET_RPC_URL = cleanEnv(
  process.env.NEXT_PUBLIC_CHAIN_RPC_URL,
  "http://127.0.0.1:8545",
);

const subscriptionAbi = [
  "function subscribe(uint256 planId, uint256 monthsCount) external",
  "function getSubscription(address subscriber) external view returns (bool active, uint256 expiry)",
  "function plans(uint256) external view returns (string memory name, uint256 monthlyPriceSats, bool active)",
];

const erc20Abi = [
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
];

const defaultPlans: SubscriptionPlan[] = [
  { id: 1, name: "Basic Monthly", monthlyPriceSats: parseUnits("0.001", 8) },
  { id: 2, name: "Premium Monthly", monthlyPriceSats: parseUnits("0.002", 8) },
];

function isTargetChain(chainId: string): boolean {
  return chainId.toLowerCase() === TARGET_CHAIN_HEX.toLowerCase();
}

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
    code?: string;
    message?: string;
    reason?: string;
    shortMessage?: string;
    info?: {
      method?: string;
      signature?: string;
    };
    value?: string;
    data?: {
      message?: string;
      originalError?: {
        message?: string;
      };
    };
  };

  if (
    candidate.code === "BAD_DATA" &&
    candidate.value === "0x" &&
    (candidate.info?.method === "balanceOf" ||
      candidate.info?.signature === "balanceOf(address)")
  ) {
    return "Token contract is unavailable on the currently selected network. Switch MetaMask to Hardhat Local and redeploy contracts if the node was restarted.";
  }

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

export default function PatientPortalHome() {
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<string>("Ready");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authLoading, setAuthLoading] = useState(false);
  const [authName, setAuthName] = useState("Patient User");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
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
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    active: false,
    expiry: 0n,
  });
  const [wbtcBalance, setWbtcBalance] = useState<bigint>(0n);
  const [walletChainId, setWalletChainId] = useState("");

  const activeConsents = useMemo(
    () => consents.filter((item) => item.active),
    [consents],
  );
  const summaryCards = [
    {
      label: "Consents",
      value: activeConsents.length.toString().padStart(2, "0"),
      tone: "mint",
    },
    {
      label: "Records",
      value: records.length.toString().padStart(2, "0"),
      tone: "sky",
    },
    {
      label: "Audits",
      value: audits.length.toString().padStart(2, "0"),
      tone: "amber",
    },
  ];
  const walletShort = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "Not connected";
  const chainLabel = walletChainId || "Unknown chain";
  const subscriptionRequired = !subscription.active;
  const invalidContractConfig =
    !isAddress(SUBSCRIPTION_ADDRESS) || !isAddress(WBTC_ADDRESS);
  const walletProviderDetected = mounted && Boolean(getEthereum());

  function saveAuthSession(token: string, user: AuthUser) {
    setAuthToken(token);
    setAuthUser(user);
    localStorage.setItem(
      PATIENT_AUTH_STORAGE_KEY,
      JSON.stringify({ token, user }),
    );
  }

  function clearAuthSession() {
    setAuthToken("");
    setAuthUser(null);
    localStorage.removeItem(PATIENT_AUTH_STORAGE_KEY);
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
              role: "patient",
            }
          : { email: authEmail, password: authPassword, role: "patient" };

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

  function getEthereum() {
    return (window as EthereumWindow).ethereum;
  }

  function requireConfiguredContracts() {
    if (invalidContractConfig) {
      throw new Error(
        "Invalid NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS or NEXT_PUBLIC_WBTC_TOKEN_ADDRESS",
      );
    }
  }

  async function ensureContractsDeployed(provider: BrowserProvider) {
    const [subscriptionCode, tokenCode] = await Promise.all([
      provider.getCode(SUBSCRIPTION_ADDRESS),
      provider.getCode(WBTC_ADDRESS),
    ]);

    if (subscriptionCode === "0x" || tokenCode === "0x") {
      throw new Error(
        "Contract bytecode not found on this network. Keep Hardhat node running, redeploy contracts, and verify NEXT_PUBLIC contract addresses.",
      );
    }
  }

  async function ensureTargetNetwork(
    ethereum: NonNullable<EthereumWindow["ethereum"]>,
  ) {
    const currentChain = (await ethereum.request({
      method: "eth_chainId",
    })) as string;
    setWalletChainId(currentChain);

    if (currentChain.toLowerCase() === TARGET_CHAIN_HEX.toLowerCase()) {
      return;
    }

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN_HEX }],
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
              decimals: 18,
            },
          },
        ],
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

      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const account = accounts[0] ?? "";
      if (!account) {
        throw new Error("No wallet account returned");
      }

      const currentChain = (await ethereum.request({
        method: "eth_chainId",
      })) as string;
      setWalletChainId(currentChain);

      setWalletAddress(account);
      if (!invalidContractConfig) {
        if (!isTargetChain(currentChain)) {
          setMessage(
            `Wallet connected. Switch to ${TARGET_CHAIN_NAME} (${TARGET_CHAIN_HEX}) to subscribe.`,
          );
          return;
        }

        await loadSubscription(account);
        setMessage("Wallet connected");
      } else {
        setMessage(
          "Wallet connected. Configure subscription contract addresses to continue.",
        );
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
    const network = await provider.getNetwork();
    const chainHex = `0x${network.chainId.toString(16)}`;

    if (!isTargetChain(chainHex)) {
      setSubscription({ active: false, expiry: 0n });
      setWbtcBalance(0n);
      throw new Error(
        `Wrong network selected. Switch MetaMask to ${TARGET_CHAIN_NAME} (${TARGET_CHAIN_HEX}).`,
      );
    }

    await ensureContractsDeployed(provider);

    const subscriptionContract = new Contract(
      SUBSCRIPTION_ADDRESS,
      subscriptionAbi,
      provider,
    );
    const tokenContract = new Contract(WBTC_ADDRESS, erc20Abi, provider);

    const [status, balance, p1, p2] = await Promise.all([
      subscriptionContract.getSubscription(address) as Promise<
        [boolean, bigint]
      >,
      tokenContract.balanceOf(address) as Promise<bigint>,
      subscriptionContract.plans(1) as Promise<[string, bigint, boolean]>,
      subscriptionContract.plans(2) as Promise<[string, bigint, boolean]>,
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
      await ensureContractsDeployed(provider);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      const tokenContract = new Contract(WBTC_ADDRESS, erc20Abi, signer);
      const subscriptionContract = new Contract(
        SUBSCRIPTION_ADDRESS,
        subscriptionAbi,
        signer,
      );

      const balance = (await tokenContract.balanceOf(signerAddress)) as bigint;
      if (balance < total) {
        throw new Error(
          `Insufficient ETH token balance. Need ${formatUnits(total, 8)} ETH, have ${formatUnits(balance, 8)} ETH`,
        );
      }

      const allowance = (await tokenContract.allowance(
        walletAddress,
        SUBSCRIPTION_ADDRESS,
      )) as bigint;
      if (allowance < total) {
        const approvalTx = await tokenContract.approve(
          SUBSCRIPTION_ADDRESS,
          total,
        );
        await approvalTx.wait();
      }

      const subscribeTx = await subscriptionContract.subscribe(
        selectedPlanId,
        monthsCount,
      );
      await subscribeTx.wait();

      await loadSubscription(walletAddress);
      setSubscriptionOpen(false);
      setMessage("Subscription payment successful via ETH token");
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
      if (walletAddress && !invalidContractConfig) {
        await loadSubscription(walletAddress);
      }
      setMessage(`Switched to ${TARGET_CHAIN_NAME} (${TARGET_CHAIN_HEX})`);
    } catch (error) {
      setMessage(normalizeError(error));
    }
  }

  async function loadAll(currentPatientId: string) {
    const [instRes, consentRes, recordsRes, auditsRes] = await Promise.all([
      apiFetch<{ institutions: Institution[] }>("/registry/institutions"),
      apiFetch<{ consents: Consent[] }>(
        `/consents?patientId=${encodeURIComponent(currentPatientId)}`,
      ),
      apiFetch<{ records: RecordItem[] }>(
        `/records/${encodeURIComponent(currentPatientId)}`,
      ),
      apiFetch<{ audits: Audit[] }>(
        `/audit?patientId=${encodeURIComponent(currentPatientId)}`,
      ),
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
          expiryUnixSeconds:
            Math.floor(Date.now() / 1000) + expiryHours * 60 * 60,
        }),
      });
      await loadAll(patientId);
      setMessage("Consent granted");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Consent grant failed",
      );
    }
  }

  async function onRevokeConsent(
    requesterInstitutionId: string,
    consentDataType: string,
  ) {
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
          dataType: consentDataType,
        }),
      });
      await loadAll(patientId);
      setMessage("Consent revoked");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Consent revoke failed",
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

    const raw = localStorage.getItem(PATIENT_AUTH_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { token?: string; user?: AuthUser };
      if (!parsed.token || !parsed.user || parsed.user.role !== "patient") {
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

    loadAll(patientId).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Load failed");
    });
  }, [mounted, patientId, authUser]);

  useEffect(() => {
    if (!mounted || !authUser) {
      return;
    }

    const ethereum = getEthereum();
    if (!ethereum) {
      return;
    }

    ethereum
      .request({ method: "eth_accounts" })
      .then((accountsUnknown) => {
        const accounts = accountsUnknown as string[];
        if (accounts.length > 0) {
          return ethereum
            .request({ method: "eth_chainId" })
            .then((chainUnknown) => {
              const chainId = chainUnknown as string;
              setWalletChainId(chainId);
              setWalletAddress(accounts[0]);
              if (isTargetChain(chainId) && !invalidContractConfig) {
                return loadSubscription(accounts[0]);
              }
              return Promise.resolve();
            });
        }
        return Promise.resolve();
      })
      .catch(() => {
        // ignore silent auto-check failures
      });
  }, [mounted, authUser]);

  useEffect(() => {
    if (!mounted || !authUser) {
      return;
    }

    const ethereum = getEthereum();
    if (!ethereum) {
      return;
    }

    ethereum
      .request({ method: "eth_chainId" })
      .then((chainUnknown) => {
        setWalletChainId(chainUnknown as string);
      })
      .catch(() => {
        // ignore silent chain check failures
      });

    const onChainChanged = (chainId: unknown) => {
      if (typeof chainId === "string") {
        setWalletChainId(chainId);
        if (!isTargetChain(chainId)) {
          setSubscription({ active: false, expiry: 0n });
          setWbtcBalance(0n);
          return;
        }

        if (walletAddress && !invalidContractConfig) {
          loadSubscription(walletAddress).catch(() => {
            // ignore silent refresh failures
          });
        }
      }
    };

    const onAccountsChanged = (accountsUnknown: unknown) => {
      const accounts = Array.isArray(accountsUnknown)
        ? (accountsUnknown as string[])
        : [];
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
  }, [mounted, invalidContractConfig, authUser, walletAddress]);

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

  if (!authUser) {
    return (
      <main className="container">
        <header className="hero">
          <h1>BlockMedShare Patient Portal</h1>
          <p>Sign in to manage consent and subscription.</p>
        </header>

        <section className="card">
          <h2>
            {authMode === "signin" ? "Patient Sign In" : "Patient Sign Up"}
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
        <div className="heroBadge">Patient workspace live</div>
        <h1>BlockMedShare Patient Portal</h1>
        <p>
          Grant and revoke data sharing consent with full audit transparency.
        </p>
        <p>
          Signed in as {authUser.name} ({authUser.email})
        </p>
        <div className="statusCluster">
          <span className="statusChip statusChip--success">
            {subscription.active ? "Subscription active" : "Subscription idle"}
          </span>
          <span className="statusChip statusChip--info">Wallet {walletShort}</span>
          <span className="statusChip statusChip--neutral">Chain {chainLabel}</span>
        </div>
      </header>

      <section className="card row">
        <button type="button" onClick={signOut}>
          Sign Out
        </button>
      </section>

      <section className="card row">
        <label>
          Patient ID
          <input
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
          />
        </label>
        <button type="button" onClick={seed}>
          Seed Demo
        </button>
        <button type="button" onClick={() => loadAll(patientId)}>
          Refresh
        </button>
        <button type="button" onClick={() => setSubscriptionOpen(true)}>
          Manage ETH Subscription
        </button>
        <p className="hint">
          Seed Demo recreates the demo patient record, institutions, and
          consent. Refresh reloads the latest consents, records, and audit trail
          from the server.
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
        <h2>Subscription Status</h2>
        <div className="statusGrid">
          <div>
            <span className="eyebrow">Wallet</span>
            <p>{walletShort}</p>
          </div>
          <div>
            <span className="eyebrow">Network</span>
            <p>{chainLabel}</p>
          </div>
          <div>
            <span className="eyebrow">Subscription</span>
            <p>{subscription.active ? "Active" : "Inactive"}</p>
          </div>
        </div>
        <p>
          Status: {subscription.active ? "Active" : "Inactive"}
          {subscription.expiry > 0n
            ? ` (expires ${new Date(Number(subscription.expiry) * 1000).toLocaleString()})`
            : ""}
        </p>
        <p>ETH Balance: {formatUnits(wbtcBalance, 8)} ETH</p>
        <div className="actionRow">
          <button
            type="button"
            onClick={() => loadSubscription(walletAddress)}
            disabled={!walletAddress}
          >
            Refresh Wallet Stats
          </button>
          <button type="button" onClick={() => setSubscriptionOpen(true)}>
            Open Subscription Panel
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Grant Consent</h2>
        <form className="grid" onSubmit={onGrantConsent}>
          <label>
            Institution
            <select
              value={institutionId}
              onChange={(event) => setInstitutionId(event.target.value)}
            >
              {institutions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Report Type
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
          <label>
            Expiry (hours)
            <input
              type="number"
              min={1}
              value={expiryHours}
              onChange={(event) =>
                setExpiryHours(Number(event.target.value) || 1)
              }
            />
          </label>
          <button type="submit">Grant</button>
        </form>
        {subscriptionRequired && (
          <p className="warning">
            An active ETH subscription is required to grant or revoke consent.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Active Consents</h2>
        <p className="hint">
          Click a revoke button to update consent state instantly and refresh the audit timeline.
        </p>
        <ul className="list">
          {activeConsents.map((item) => (
            <li key={item.id}>
              <span>
                {item.requesterInstitutionId} | {item.dataType} | {item.purpose}{" "}
                | expires{" "}
                {new Date(item.expiryUnixSeconds * 1000).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() =>
                  onRevokeConsent(item.requesterInstitutionId, item.dataType)
                }
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      </section>

      {subscriptionOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="modalCard">
            <h2>Subscribe Using ETH on MetaMask</h2>
            <p>
              Payment is processed using ETH-compatible token flow through
              MetaMask.
            </p>
            <p className="hint">
              Required chain: {TARGET_CHAIN_NAME} ({TARGET_CHAIN_HEX}). Current
              chain:{" "}
              {walletChainId ||
                (walletProviderDetected
                  ? "Not connected"
                  : "MetaMask provider not detected")}
            </p>
            {!walletProviderDetected && (
              <p className="warning">
                MetaMask is not available in this browser context. Open the
                patient portal in a normal browser profile where MetaMask
                extension is installed and unlocked.
              </p>
            )}
            <p className="hint">
              Runtime config: subscription{" "}
              {isAddress(SUBSCRIPTION_ADDRESS) ? "ok" : "invalid"} (
              {SUBSCRIPTION_ADDRESS || "empty"}), token{" "}
              {isAddress(WBTC_ADDRESS) ? "ok" : "invalid"} (
              {WBTC_ADDRESS || "empty"})
            </p>
            {invalidContractConfig && (
              <p className="warning">
                Invalid contract configuration. Set
                NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS and
                NEXT_PUBLIC_WBTC_TOKEN_ADDRESS.
              </p>
            )}

            {!walletAddress ? (
              <button type="button" onClick={connectWallet}>
                Connect MetaMask
              </button>
            ) : (
              <p>Connected: {walletAddress}</p>
            )}

            <button
              type="button"
              onClick={switchNetworkManually}
              disabled={!getEthereum()}
            >
              Switch Network
            </button>

            <form className="grid" onSubmit={subscribeWithBtc}>
              <label>
                Plan
                <select
                  value={selectedPlanId}
                  onChange={(event) =>
                    setSelectedPlanId(Number(event.target.value))
                  }
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - {formatUnits(plan.monthlyPriceSats, 8)} ETH
                      / month
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
                  onChange={(event) =>
                    setMonthsCount(Number(event.target.value) || 1)
                  }
                />
              </label>

              <button
                type="submit"
                disabled={
                  subscriptionLoading || !walletAddress || invalidContractConfig
                }
              >
                {subscriptionLoading ? "Processing..." : "Approve & Subscribe"}
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionOpen(false)}
                disabled={subscriptionLoading}
              >
                Close
              </button>
            </form>
          </div>
        </div>
      )}

      <section className="card">
        <h2>Patient Records (Encrypted Off-chain Metadata)</h2>
        <p className="hint">Hover the records to inspect the stored encrypted metadata references.</p>
        <ul className="list">
          {records.map((item) => (
            <li key={item.id}>
              {item.dataType} | created by {item.createdByInstitutionId} | hash{" "}
              {item.hash.slice(0, 16)}...
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Audit Trail</h2>
        <p className="hint">The latest consent and access events appear here after each on-chain and API action.</p>
        <ul className="list">
          {audits.map((item) => (
            <li key={item.id}>
              {item.timestamp} | {item.requesterInstitutionId} | {item.dataType}{" "}
              | {item.purpose} | {item.decision} ({item.reason})
            </li>
          ))}
        </ul>
      </section>

      <p className="status">Status: {message}</p>
    </main>
  );
}
