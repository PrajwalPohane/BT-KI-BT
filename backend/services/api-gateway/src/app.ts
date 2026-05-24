import cors from "cors";
import express from "express";
import helmet from "helmet";
import "./config/env";
import { accessRouter } from "./routes/access";
import { authRouter } from "./routes/auth";
import { auditRouter } from "./routes/audit";
import { consentRouter } from "./routes/consents";
import { healthRouter } from "./routes/health";
import { recordsRouter } from "./routes/records";
import { registryRouter } from "./routes/registry";
import { seedRouter } from "./routes/seed";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (
      process.env.CORS_ORIGIN ?? "http://localhost:3000,http://localhost:3001"
    ).split(","),
  }),
);
app.use(express.json());

app.use("/auth", authRouter);
app.use("/health", healthRouter);
app.use("/registry", registryRouter);
app.use("/records", recordsRouter);
app.use("/consents", consentRouter);
app.use("/access", accessRouter);
app.use("/audit", auditRouter);
app.use("/seed", seedRouter);
