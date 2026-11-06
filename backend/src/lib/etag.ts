import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Weak ETag for a serialized JSON payload. Shared with the Redis cache HIT path
 * so a cache hit revalidates to a bodyless 304 instead of resending the payload.
 */
export function weakEtag(payload: string): string {
  const hash = createHash("sha1").update(payload).digest("hex").slice(0, 27);
  return `W/"${payload.length.toString(36)}-${hash}"`;
}

/**
 * Weak ETag for idempotent GETs. Send 304 when the client already has
 * the payload so dashboard/list polls stay cheap.
 */
export function etag() {
  return function etagMiddleware(_req: Request, res: Response, next: NextFunction) {
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300 && body !== undefined) {
        try {
          const payload = typeof body === "string" ? body : JSON.stringify(body);
          res.setHeader("ETag", weakEtag(payload));
        } catch {
          // Non-fatal: serve without an ETag.
        }
      }
      return originalJson(body);
    } as Response["json"];
    next();
  };
}
