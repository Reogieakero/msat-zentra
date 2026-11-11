import type { NextFunction, Request, Response } from "express";
import { getRedis } from "./redis.js";
import { getEnv } from "../config/env.js";
import { logger } from "./pino.js";
import { weakEtag } from "./etag.js";

function buildKey(req: Request): string {
  const user = (req as Request & { user?: { id?: string; role?: string } }).user;
  const role = user?.role ?? "anon";
  const uid = user?.id ?? "anon";
  const qs = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";
  // NOTE: req.path is relative to the mounted router, so every router root
  // ("/api/overview", "/api/academics", …) would collapse to "/". Include the
  // mount point (baseUrl) so keys are unique per endpoint. The "v2" prefix
  // orphans entries cached under the old colliding scheme (they expire by TTL).
  const fullPath = `${req.baseUrl ?? ""}${req.path ?? ""}` || req.originalUrl.split("?")[0];

  const scope = (req as Request & { termScope?: { schoolYearId?: string; termId?: string } }).termScope;
  const scopeKey = scope ? `:${scope.schoolYearId ?? ""}:${scope.termId ?? ""}` : "";
  return `cache:v2:${req.method}:${fullPath}${qs}:${role}:${uid}${scopeKey}`;
}

function tagKey(tag: string): string {
  return `cache-tag:${tag}`;
}

export interface CacheOptions {

  ttl?: number;

  tags?: string[];

  /** Cache-Control header sent with the response. Defaults to a short private TTL. */
  cacheControl?: string;
}

export function cache(options: CacheOptions = {}) {
  return async function cacheMiddleware(req: Request, res: Response, next: NextFunction) {

    if (req.method !== "GET") return next();
    const redis = getRedis();
    // Never let the browser reuse an API payload: Redis is the cache, and a
    // client-side max-age kept serving pre-write lists for up to 30s after a
    // PATCH (a completed ADM case popped back onto its board on refetch).
    // Awaited tag invalidation completes before the write responds, so the
    // refetch that follows always misses the stale entry.
    // "private, no-cache" (store-but-revalidate) would avoid the stale-list bug
    // above, but it writes confidential records to the browser's disk cache, so
    // no-store stays the default; pass cacheControl explicitly to opt a route in.
    const cacheControl = options.cacheControl ?? "private, no-store";
    res.setHeader("Cache-Control", cacheControl);
    if (!redis) return next();

    // Escape hatch for realtime-driven refetches: a write's cache-tag
    // invalidation and its notification fanout are both fire-and-forget, so a
    // client that refetches the instant the notification lands can still race
    // the invalidation and read the pre-write payload. A caller that knows the
    // data just changed (the guidance boards refetching off a realtime event)
    // sets this header to skip the read; the fresh body is still written back
    // to the same key, so the stale entry is replaced rather than bypassed.
    const bypass = req.get("x-zentra-fresh") === "1";

    const key = buildKey(req);
    try {
      if (!bypass) {
        const hit = await redis.get<string>(key);
        if (hit) {
          const payload = typeof hit === "string" ? hit : JSON.stringify(hit);
          res.setHeader("x-cache", "HIT");
          res.setHeader("content-type", "application/json");
          // The live path gets its ETag from the `etag()` middleware, which wraps
          // res.json — this HIT path uses res.send, so it would otherwise ship the
          // full body on every repeat read. Same tag algorithm, so Express answers
          // req.fresh with a bodyless 304 when the client already has it.
          res.setHeader("ETag", weakEtag(payload));
          return res.status(200).send(payload);
        }
      }
    } catch (err) {
      logger.warn({ err, key }, "cache read failed — serving live");
      return next();
    }

    res.setHeader("x-cache", bypass ? "BYPASS" : "MISS");

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const ttl = options.ttl ?? getEnv().CACHE_TTL_SECONDS;
        const payload = typeof body === "string" ? body : JSON.stringify(body);
        redis
          .set(key, payload, { ex: ttl })
          .then(() => {
            if (options.tags?.length) {
              return Promise.all(
                options.tags.map((t) => redis.sadd(tagKey(t), key).then(() => redis.expire(tagKey(t), ttl * 4))),
              );
            }
          })
          .catch((err) => logger.warn({ err, key }, "cache write failed"));
      }
      return originalJson(body);
    } as Response["json"];

    next();
  };
}

export async function invalidateTags(tags: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || tags.length === 0) return;
  try {
    // Fan the membership reads out in parallel. The old sequential loop
    // paid up to 3 Upstash REST roundtrips per tag, awaited before the
    // response — e.g. ~13 tags on refer ≈ 13s of send latency from PH.
    const members = await Promise.all(tags.map((tag) => redis.smembers(tagKey(tag))));
    const doomed: string[] = [];
    for (const [i, tag] of tags.entries()) {
      const keys = members[i] ?? [];
      if (keys.length > 0) doomed.push(...keys, tagKey(tag));
    }
    // Batched DELs keep REST payloads small; skipped entirely when empty.
    for (let i = 0; i < doomed.length; i += 500) {
      const slice = doomed.slice(i, i + 500);
      if (slice.length > 0) await redis.del(...slice);
    }
  } catch (err) {
    logger.warn({ err, tags }, "cache invalidation failed");
  }
}
