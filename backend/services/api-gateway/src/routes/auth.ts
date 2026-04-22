import { Request, Response, Router } from "express";
import { getUserFromToken, signInUser, signUpUser } from "../lib/auth";
import { AuthSignInSchema, AuthSignUpSchema } from "../lib/schemas";

export const authRouter = Router();

authRouter.post("/signup", (req: Request, res: Response) => {
  const parsed = AuthSignUpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = signUpUser(parsed.data);
    return res.status(201).json(result);
  } catch (error) {
    return res
      .status(400)
      .json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
  }
});

authRouter.post("/signin", (req: Request, res: Response) => {
  const parsed = AuthSignInSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = signInUser(parsed.data);
    return res.status(200).json(result);
  } catch (error) {
    return res
      .status(401)
      .json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
  }
});

authRouter.get("/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  const user = getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  return res.status(200).json({ user });
});
