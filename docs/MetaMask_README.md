# MetaMask Handling and Local Run Guide

This guide explains how to run BlockMedShare locally with MetaMask, how to keep chain state stable, and how to resolve the common issues seen in this project.

## 1. Prerequisites

- Node.js installed
- MetaMask extension installed in Chrome or Edge
- Local project cloned and dependencies installed

## 2. Start Services in Correct Order

Always use this order. Most runtime issues happen when this order is broken.

1. Start local blockchain node:
   - npm run node --prefix backend/blockchain
2. Deploy contracts to local node:
   - npm run deploy:local --prefix backend/blockchain
3. Start API:
   - npm run dev:api
4. Start listener:
   - npm run dev:listener
5. Start frontend apps:
   - npm run dev:patient
   - npm run dev:hospital

Important:
- Keep the blockchain node terminal running.
- If you stop/restart the node, redeploy contracts again.

## 3. MetaMask Network Setup (Hardhat Local)

Add a custom network in MetaMask:

- Network Name: Hardhat Local
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency Symbol: ETH

## 4. Contract Environment Variables

Use these addresses from the latest deploy command output.

Frontend (patient app):
- NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ADDRESS
- NEXT_PUBLIC_WBTC_TOKEN_ADDRESS
- NEXT_PUBLIC_CHAIN_HEX=0x7a69
- NEXT_PUBLIC_CHAIN_RPC_URL=http://127.0.0.1:8545

Backend:
- SUBSCRIPTION_CONTRACT_ADDRESS
- SUBSCRIPTION_RPC_URL=http://127.0.0.1:8545

Where to set frontend values:
- frontend/apps/patient-portal/.env.local

Where to set shared values:
- .env

After env changes:
- Restart patient app and API.

## 5. Import Hardhat Test Account into MetaMask

From the Hardhat node output, import one of the listed private keys into MetaMask.

Recommended for first run:
- Account #0 (deployer account)

Reason:
- It always has ETH for gas and is easiest for initial flow checks.

## 6. Token Balance Requirement for Subscription

Subscription requires BTC-style token (mBTC/WBTC test token), not just ETH.

If the UI shows:
- Status: Inactive
- WBTC Balance: 0.0 BTC

Then fund the connected wallet with test token (local only). Example script run from backend/blockchain:

- node -e "const { JsonRpcProvider, Contract, parseUnits } = require('ethers'); (async()=>{ const provider = new JsonRpcProvider('http://127.0.0.1:8545'); const signer = await provider.getSigner(0); const token = new Contract('0x5FbDB2315678afecb367f032d93F642f64180aa3',['function mint(address to,uint256 amount) external'], signer); await (await token.mint('YOUR_WALLET', parseUnits('1',8))).wait(); })().catch(e=>{ console.error(e); process.exit(1); });"

Then refresh patient portal and subscribe.

## 7. How Subscription Becomes Active

In patient portal modal:

1. Connect MetaMask
2. Confirm correct chain (0x7a69)
3. Click Approve & Subscribe
4. Approve token allowance in MetaMask
5. Approve subscribe transaction in MetaMask
6. Click Refresh in UI

Expected result:
- Status changes to Active
- Expiry timestamp appears

## 8. Common Errors and Fixes

### A) MetaMask provider not detected

Cause:
- App opened in browser context without extension injection.

Fix:
- Open app in normal Chrome/Edge tab (not embedded preview).
- Unlock MetaMask.

### B) Calling an account which is not a contract

Cause:
- Node restarted but contracts were not redeployed.

Fix:
1. Keep node running
2. Run deploy:local again
3. Update env addresses if changed
4. Restart apps

### C) Subscription still inactive

Cause:
- No subscribe transaction mined yet, or wallet has 0 token balance.

Fix:
- Ensure token balance > 0
- Run Approve & Subscribe from same wallet

### D) EADDRINUSE on port 8545 or 4000

Cause:
- Duplicate process already running.

Fix:
- Reuse existing process, do not start duplicate.
- Or stop old process and start once.

### E) Listener fetch failed / ECONNREFUSED

Cause:
- API not running.

Fix:
- Start API first, then listener.

## 9. Quick Validation Checklist

- Node running on 127.0.0.1:8545
- Contracts deployed to active node session
- API running on port 4000
- Patient app running on port 3000
- MetaMask on Hardhat Local chain (31337)
- Connected wallet has ETH and mBTC balance
- Approve and Subscribe both confirmed

## 10. Security Note

Hardhat keys are public test keys. Never use them on Mainnet or any real funded network.
