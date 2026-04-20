import { Request, Response, Router } from "express";
import { requestAccess } from "../domain/service";
import { AccessRequestSchema } from "../lib/schemas";

export const accessRouter = Router();

accessRouter.post("/request", (req: Request, res: Response) => {
  const parsed = AccessRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = requestAccess(parsed.data);
  return res.status(200).json(result);
});
