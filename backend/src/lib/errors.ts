import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string[]> | null;
  constructor(status: number, code: string, message: string, fields?: Record<string, string[]> | null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields ?? null;
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, fields: err.fields },
    });
  }
  // Prisma known request errors -> meaningful HTTP statuses instead of 500.
  // P2002 unique violation (e.g. double-submit) -> 409, P2003 FK violation
  // (e.g. bad adviserId) -> 400, P2025 record-not-found -> 404.
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code?: unknown }).code ?? "");
    if (code === "P2002") {
      const target = (err as { meta?: { target?: unknown } }).meta?.target;
      const detail = Array.isArray(target) ? ` (${target.join(", ")})` : "";
      return res.status(409).json({
        error: { code: "DUPLICATE", message: `Duplicate record${detail}. It may already exist.` },
      });
    }
    if (code === "P2003") {
      return res.status(400).json({
        error: { code: "INVALID_REFERENCE", message: "Referenced record does not exist." },
      });
    }
    if (code === "P2025") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Record not found." },
      });
    }
  }
  // Zod validation errors
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues;
    const fields: Record<string, string[]> = {};
    for (const issue of issues) {
      const key = issue.path.join(".") || "_";
      fields[key] = fields[key] ? [...fields[key], issue.message] : [issue.message];
    }
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", fields } });
  }
  // Database connectivity failures (pooler down, wrong port, network blip)
  // -> 503 so clients know the failure is transient and retryable, instead
  // of a raw stack trace + generic 500. Covers Prisma P1001/P1008/P1017 and
  // raw driver codes surfaced through the pg adapter (ETIMEDOUT, etc.).
  if (err && typeof err === "object" && "code" in err) {
    const connCode = String((err as { code?: unknown }).code ?? "");
    if (
      connCode === "P1001" ||
      connCode === "P1008" ||
      connCode === "P1017" ||
      connCode === "ETIMEDOUT" ||
      connCode === "ECONNREFUSED" ||
      connCode === "ENOTFOUND" ||
      connCode === "EHOSTUNREACH" ||
      connCode === "ECONNRESET"
    ) {
      console.error(err);
      return res.status(503).json({
        error: { code: "DB_UNAVAILABLE", message: "Database temporarily unavailable. Please try again." },
      });
    }
  }
  console.error(err);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
}
