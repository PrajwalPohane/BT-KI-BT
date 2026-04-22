import dotenv from "dotenv";

dotenv.config();

const startBlock = Number(process.env.LISTENER_START_BLOCK ?? 0);
const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

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

let seen = new Set<string>();
let apiReachable = false;
let lastPollError = "";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function pullAudits() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/audit`, {
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to pull audits: ${response.status}`);
  }

  const payload = (await response.json()) as { audits: Audit[] };
  for (const entry of payload.audits) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      console.log(
        `[event-listener] ${entry.timestamp} ${entry.requesterInstitutionId} ${entry.patientId} ${entry.dataType} ${entry.purpose} ${entry.decision} ${entry.reason}`
      );
    }
  }
}

async function main() {
  console.log(`[event-listener] booted from block ${startBlock}`);
  console.log(`[event-listener] polling ${apiBaseUrl}/audit`);

  pullAudits().catch((error) => {
    const message = errorMessage(error);
    lastPollError = message;
    console.error(`[event-listener] initial poll failed (${message}). Waiting for API at ${apiBaseUrl}`);
  });

  setInterval(() => {
    pullAudits()
      .then(() => {
        if (!apiReachable) {
          apiReachable = true;
          lastPollError = "";
          console.log("[event-listener] API reachable, polling resumed");
        }
      })
      .catch((error) => {
        const message = errorMessage(error);
        if (apiReachable || message !== lastPollError) {
          console.error(`[event-listener] polling error (${message})`);
          apiReachable = false;
          lastPollError = message;
        }
      });
  }, 3000);
}

main().catch((error) => {
  console.error("[event-listener] failed", error);
  process.exit(1);
});
