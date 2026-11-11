/**
 * Flush the Upstash Redis response cache (all `cache:v2:*` payloads + their
 * `cache-tag:*` sets). Needed after out-of-band DB edits (scripts, SQL) that
 * bypass the app's `invalidateTags` — cached GETs would otherwise keep serving
 * deleted rows until their TTL expires (up to 15 min for some desks).
 *
 *   npx tsx scripts/flush-cache.ts
 */
import "dotenv/config";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.log("No UPSTASH_REDIS_REST_URL/TOKEN — caching is off, nothing to flush.");
  process.exit(0);
}

const redis = new Redis({ url, token });
const keys = await redis.keys("cache*");
if (keys.length === 0) {
  console.log("Cache already empty.");
  process.exit(0);
}

let removed = 0;
for (let i = 0; i < keys.length; i += 500) {
  await redis.del(...keys.slice(i, i + 500));
  removed += Math.min(500, keys.length - i);
}
console.log(`Flushed ${removed} cache key(s).`);
