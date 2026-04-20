import { Request, Response, Router } from "express";
import { listAudits } from "../domain/service";

export const auditRouter = Router();

auditRouter.get("/", (req: Request, res: Response) => {
  const patientId = typeof req.query.patientId === "string" ? req.query.patientId : undefined;
  const requesterInstitutionId =
    typeof req.query.requesterInstitutionId === "string" ? req.query.requesterInstitutionId : undefined;

  return res.status(200).json({ audits: listAudits({ patientId, requesterInstitutionId }) });
});
