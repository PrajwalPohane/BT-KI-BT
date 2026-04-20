import { Request, Response, Router } from "express";
import { registerInstitution, listInstitutions } from "../domain/service";
import { RegisterInstitutionSchema } from "../lib/schemas";

export const registryRouter = Router();

registryRouter.get("/institutions", (_req: Request, res: Response) => {
  res.status(200).json({ institutions: listInstitutions() });
});

registryRouter.post("/institutions", (req: Request, res: Response) => {
  const parsed = RegisterInstitutionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const institution = registerInstitution(parsed.data);
  return res.status(201).json({ institution });
});
