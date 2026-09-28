import type { NextFunction, Request, Response } from "express";
import { resolveTermScope } from "../lib/termScope.js";

/**
 * Attaches the request's active School Year + Term (`req.termScope`).
 *
 * Mounted on `/api` (after `/api/auth`) so every data/transaction route
 * shares one resolution: explicit `?schoolYearId=`/`?termId=` override →
 * `x-school-year-id`/`x-term-id` session headers → database-active year.
 * Never fails the request — routes fall back to legacy behavior when the
 * scope is null (no calendar seeded yet).
 */
export async function attachTermScope(req: Request, _res: Response, next: NextFunction) {
  try {
    req.termScope = (await resolveTermScope(req)) ?? undefined;
  } catch {
    req.termScope = undefined;
  }
  next();
}
