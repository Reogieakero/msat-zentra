import type { NextFunction, Request, Response } from "express";
import { verifyAccess } from "../lib/jwt.js";
import { resolveTermScope } from "../lib/termScope.js";

/**
 * Role from the access token, when present. Mirrors requireAuth's token
 * verification without rejecting the request (auth itself is enforced per
 * route). Invalid/absent tokens resolve as "no role".
 */
function roleOf(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  try {
    return verifyAccess(header.slice(7)).role ?? null;
  } catch {
    return null;
  }
}

export async function attachTermScope(req: Request, _res: Response, next: NextFunction) {
  try {
    req.termScope = (await resolveTermScope(req, roleOf(req))) ?? undefined;
  } catch {
    req.termScope = undefined;
  }
  next();
}
