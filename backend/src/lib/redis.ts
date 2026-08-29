import { Redis } from "@upstash/redis";
import { getEnv } from "../config/env.js";
import { logger } from "./pino.js";

let client: Redis | null = null;

function isConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Lazily-initialized Upstash Redis REST client (TLS is handled by the REST
 * endpoint). Returns null when caching is disabled or unconfigured so callers
 * can fall back to live data without crashing.
 */
export function getRedis(): Redis | null {
  if (!getEnv().CACHE_ENABLED) return null;
  if (client) return client;
  if (!isConfigured()) {
    logger.warn("Upstash Redis not configured — caching disabled");
    return null;
  }
  const env = getEnv();
  client = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return client;
}

export function redisConfigured(): boolean {
  return getEnv().CACHE_ENABLED && isConfigured();
}
