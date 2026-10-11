import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

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
          const hash = createHash("sha1").update(payload).digest("hex").slice(0, 27);
          const tag = `W/"${payload.length.toString(36)}-${hash}"`;
          res.setHeader("ETag", tag);
        } catch {
          // Non-fatal: serve without an ETag.
        }
      }
      return originalJson(body);
    } as Response["json"];
    next();
  };
}
