import type { NextFunction, Request, Response } from "express";
import { getRedis } from "./redis.js";
import { getEnv } from "../config/env.js";
import { logger } from "./pino.js";

/**
 * Response cache for read-heavy GET routes (Principal/Registrar pages).
 *
 * - Keyed by method + path + query string + caller role so different roles
 *   never share a cached payload (Principal vs Registrar scopes differ).
 * - On hit, the cached JSON is served and `x-cache: HIT` is set.
 * - On miss, the response is captured via a patched `res.json` and stored with
 *   the configured TTL (seconds), tagged so it can be purged later.
 * - Failures (Redis down, serialize error) degrade to live responses — caching
 *   is strictly best-effort.
 */

function buildKey(req: Request): string {
  const role = (req as Request & { user?: { role?: string } }).user?.role ?? "anon";
  const qs = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";
  return `cache:${req.method}:${req.path}${qs}:${role}`;
}

function tagKey(tag: string): string {
  return `cache-tag:${tag}`;
}

export interface CacheOptions {
  /** Cache TTL in seconds. Defaults to CACHE_TTL_SECONDS. */
  ttl?: number;
  /** Invalidation tags attached to the cached entry. */
  tags?: string[];
}

export function cache(options: CacheOptions = {}) {
  return async function cacheMiddleware(req: Request, res: Response, next: NextFunction) {
    // Only cache idempotent GETs.
    if (req.method !== "GET") return next();
    const redis = getRedis();
    if (!redis) return next();

    const key = buildKey(req);
    try {
      const hit = await redis.get<string>(key);
      if (hit) {
        res.setHeader("x-cache", "HIT");
        res.setHeader("content-type", "application/json");
        return res.status(200).send(typeof hit === "string" ? hit : JSON.stringify(hit));
      }
    } catch (err) {
      logger.warn({ err, key }, "cache read failed — serving live");
      return next();
    }

    res.setHeader("x-cache", "MISS");

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

/**
 * Purge every cached entry carrying one of the given tags. Call this from
 * write routes (approve / lock / validate / release) so the next read is live.
 */
export async function invalidateTags(tags: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || tags.length === 0) return;
  try {
    for (const tag of tags) {
      const keys = await redis.smembers(tagKey(tag));
      if (keys.length) {
        await redis.del(...keys);
        await redis.del(tagKey(tag));
      }
    }
  } catch (err) {
    logger.warn({ err, tags }, "cache invalidation failed");
  }
}
