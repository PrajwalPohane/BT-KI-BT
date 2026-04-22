import { Contract, JsonRpcProvider, isAddress } from "ethers";

const subscriptionAbi = [
  "function getSubscription(address subscriber) external view returns (bool active, uint256 expiry)"
];

const enforceSubscription = (process.env.ENFORCE_SUBSCRIPTION ?? "true") === "true";
const subscriptionRpcUrl = process.env.SUBSCRIPTION_RPC_URL ?? process.env.RPC_URL ?? "";
const subscriptionContractAddress = process.env.SUBSCRIPTION_CONTRACT_ADDRESS ?? "";

let provider: JsonRpcProvider | null = null;
let contract: Contract | null = null;

function getSubscriptionContract(): Contract {
  if (!subscriptionRpcUrl) {
    throw new Error("SUBSCRIPTION_RPC_URL (or RPC_URL) is not configured");
  }
  if (!subscriptionContractAddress) {
    throw new Error("SUBSCRIPTION_CONTRACT_ADDRESS is not configured");
  }

  if (!provider) {
    provider = new JsonRpcProvider(subscriptionRpcUrl);
  }
  if (!contract) {
    contract = new Contract(subscriptionContractAddress, subscriptionAbi, provider);
  }

  return contract;
}

export async function hasActiveSubscription(walletAddress: string): Promise<boolean> {
  if (!enforceSubscription) {
    return true;
  }

  if (!walletAddress || !isAddress(walletAddress)) {
    return false;
  }

  const subscriptionContract = getSubscriptionContract();
  const status = await subscriptionContract.getSubscription(walletAddress) as [boolean, bigint];
  const now = BigInt(Math.floor(Date.now() / 1000));

  return status[0] && status[1] > now;
}

export function isSubscriptionEnforced(): boolean {
  return enforceSubscription;
}
