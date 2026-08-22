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
  console.error(err);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
}
