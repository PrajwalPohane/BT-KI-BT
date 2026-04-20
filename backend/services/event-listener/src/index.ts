import dotenv from "dotenv";

dotenv.config();

const startBlock = Number(process.env.LISTENER_START_BLOCK ?? 0);
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

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

async function pullAudits() {
  const response = await fetch(`${apiBaseUrl}/audit`);
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

  await pullAudits();
  setInterval(() => {
    pullAudits().catch((error) => {
      console.error("[event-listener] polling error", error);
    });
  }, 3000);
}

main().catch((error) => {
  console.error("[event-listener] failed", error);
  process.exit(1);
});
