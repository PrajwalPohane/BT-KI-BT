import { Request, Response, Router } from "express";
import { seedDemoData } from "../domain/service";

export const seedRouter = Router();

seedRouter.post("/", (_req: Request, res: Response) => {
  seedDemoData();

  res.status(200).json({ ok: true });
});
