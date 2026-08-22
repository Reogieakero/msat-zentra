import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { verifyAccess } from "../lib/jwt.js";

export interface AuthUser {
  id: string;
  role: string;
  gradeBand?: "7-10" | "11-12" | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new AppError(401, "UNAUTHORIZED", "Missing bearer token"));
  }
  try {
    const payload = verifyAccess(header.slice(7));
    req.user = { id: payload.sub, role: payload.role, gradeBand: payload.gradeBand ?? null };
    next();
  } catch {
    next(new AppError(401, "UNAUTHORIZED", "Invalid or expired token"));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", `Requires role: ${roles.join(", ")}`));
    }
    next();
  };
}

export function requireOwnershipOrRole(getOwnerId: (req: Request) => string | Promise<string>, ...roles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    if (roles.includes(req.user.role)) return next();
    try {
      const ownerId = await getOwnerId(req);
      if (ownerId === req.user.id) return next();
    } catch {
      /* fall through to 403 */
    }
    next(new AppError(403, "FORBIDDEN", "Not authorized for this resource"));
  };
}
