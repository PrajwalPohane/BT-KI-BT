# BlockMedShare Setup (Separate Frontend and Backend)

This workspace is prepared with separate frontend and backend setups.

## Structure

- frontend/apps/patient-portal: Patient-facing frontend (Next.js)
- frontend/apps/hospital-portal: Hospital-facing frontend (Next.js)
- backend/services/api-gateway: Backend API service (Express + TypeScript)
- backend/services/event-listener: Backend blockchain event worker (TypeScript)
- backend/blockchain: Smart contracts, tests, and deployment scripts (Hardhat)
- backend/packages/shared-types: Shared domain schemas and types
- backend/infra/docker: Local infrastructure compose file

## Frontend Setup

1. Install frontend dependencies only:
   - npm run setup:frontend
2. Start patient app:
   - npm run dev:patient
3. Start hospital app:
   - npm run dev:hospital

## Backend Setup

1. Install backend dependencies only:
   - npm run setup:backend
2. Start API:
   - npm run dev:api
3. Start event listener:
   - npm run dev:listener
4. Test contracts:
   - npm run test:blockchain

## Environment

1. Copy .env.example to .env
2. Fill secrets and addresses

## Optional Local Infra

- docker compose -f backend/infra/docker/docker-compose.dev.yml up -d