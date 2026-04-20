# Required Dependencies

## System Prerequisites

- Node.js 20.11.1 or later
- npm 10 or later
- Docker Desktop (optional, for local infra)

## Frontend Dependencies

### frontend/apps/patient-portal

Runtime:
- next@15.3.1
- react@19.1.0
- react-dom@19.1.0

Dev:
- typescript@^5.8.3
- @types/react@19.1.2
- @types/react-dom@19.1.2

### frontend/apps/hospital-portal

Runtime:
- next@15.3.1
- react@19.1.0
- react-dom@19.1.0

Dev:
- typescript@^5.8.3
- @types/react@19.1.2
- @types/react-dom@19.1.2

## Backend Dependencies

### backend/services/api-gateway

Runtime:
- express@^4.21.2
- cors@^2.8.5
- helmet@^8.1.0
- dotenv@^16.4.5
- jsonwebtoken@^9.0.2
- zod@^3.23.8

Dev:
- typescript@^5.8.3
- tsx@^4.19.4
- @types/express@^4.17.21
- @types/cors@^2.8.17
- @types/jsonwebtoken@^9.0.6

### backend/services/event-listener

Runtime:
- dotenv@^16.4.5
- ethers@^6.13.4

Dev:
- typescript@^5.8.3
- tsx@^4.19.4

### backend/packages/shared-types

Runtime:
- zod@^3.23.8

Dev:
- typescript@^5.8.3

### backend/blockchain

Dev:
- hardhat@^2.24.0
- @nomicfoundation/hardhat-toolbox@^5.0.0
- @nomicfoundation/hardhat-ethers@^3.0.8
- ethers@^6.13.4
- ts-node@^10.9.2
- typescript@^5.8.3

## Root Workspace Dev Dependencies

- typescript@^5.8.3
- @types/node@^22.15.17
- prettier@^3.5.3

## Installation Commands

Install frontend only:
- npm run setup:frontend

Install backend only:
- npm run setup:backend

Install all workspaces:
- npm install --prefix frontend
- npm install --prefix backend
