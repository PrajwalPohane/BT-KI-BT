import { Request, Response, Router } from "express";
import { grantConsent, listConsents, revokeConsent } from "../domain/service";
import { CreateConsentSchema, RevokeConsentSchema } from "../lib/schemas";

export const consentRouter = Router();

consentRouter.get("/", (req: Request, res: Response) => {
  const patientId = typeof req.query.patientId === "string" ? req.query.patientId : undefined;
  return res.status(200).json({ consents: listConsents(patientId) });
});

consentRouter.post("/", (req: Request, res: Response) => {
  const parsed = CreateConsentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const consent = grantConsent(parsed.data);
    return res.status(201).json({ consent });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

consentRouter.post("/revoke", (req: Request, res: Response) => {
  const parsed = RevokeConsentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const consent = revokeConsent(parsed.data);
    return res.status(200).json({ consent });
  } catch (error) {
    return res.status(404).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});
