import { Request, Response, Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    service: "api-gateway",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});