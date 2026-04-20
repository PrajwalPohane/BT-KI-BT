import { Request, Response, Router } from "express";
import { createEncryptedRecord, listPatientRecords } from "../domain/service";
import { CreateRecordSchema } from "../lib/schemas";

export const recordsRouter = Router();

recordsRouter.post("/", (req: Request, res: Response) => {
  const parsed = CreateRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const record = createEncryptedRecord(parsed.data);
    return res.status(201).json({ record });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

recordsRouter.get("/:patientId", (req: Request, res: Response) => {
  const records = listPatientRecords(req.params.patientId);
  return res.status(200).json({ records });
});
