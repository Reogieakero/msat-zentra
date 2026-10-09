import type { NextFunction, Request, Response } from "express";
import { getRedis } from "./redis.js";
import { getEnv } from "../config/env.js";
import { logger } from "./pino.js";

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
}

export function cache(options: CacheOptions = {}) {
  return async function cacheMiddleware(req: Request, res: Response, next: NextFunction) {

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
