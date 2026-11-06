import type { NextFunction, Request, Response } from "express";
import { logger } from "./pino.js";

// Lightweight request instrumentation: duration + response size.
// Never logs bodies, query values, or PII — only route, method, status.
export function perfLog(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  const originalJson = res.json.bind(res);
  let bytes = 0;
  (res as Response & { json: unknown }).json = function (body: unknown) {
    try {
      bytes = Buffer.byteLength(
        typeof body === "string" ? body : JSON.stringify(body),
        "utf8",
      );
    } catch {
      bytes = 0;
    }
    return originalJson(body);
  } as Response["json"];

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    // Flag only genuinely slow API calls; normal paged lists should be <2s.
    // 20-30s is the emergency ceiling, never the target.
    if (durationMs > 2000 || res.statusCode >= 500) {
      logger.warn(
        {
          method: req.method,
          route: req.path,
          status: res.statusCode,
          durationMs: Math.round(durationMs),
          bytes,
        },
        "slow api request",
      );
    }
  });
  next();
}
