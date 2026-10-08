import type { NextFunction, Request, Response } from "express";
import { resolveTermScope } from "../lib/termScope.js";

export async function attachTermScope(req: Request, _res: Response, next: NextFunction) {
  try {
    req.termScope = (await resolveTermScope(req)) ?? undefined;
  } catch {
    req.termScope = undefined;
  }
  next();
}
