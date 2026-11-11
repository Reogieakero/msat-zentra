import { z } from "zod";
import { logger } from "../lib/pino.js";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default("60m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  MOBILE_ORIGIN: z.string().default("msat-zentra://app"),
  STORAGE_BUCKET: z.string().default("zentra-docs"),
  SF10_STORAGE_BUCKET: z.string().min(1).optional(),
  REFERRAL_STORAGE_BUCKET: z.string().min(1).optional(),
  CLINIC_STORAGE_BUCKET: z.string().min(1).optional(),
  OCR_WORKER_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  CACHE_TTL_SECONDS: z.coerce.number().default(60),
  CACHE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  GRADE_FLAG_ESCALATION_DAYS: z.coerce.number().default(7),
  // Proxy hops to trust for req.ip (presence geolocation). Defaults to 1 in
  // production so a reverse proxy's X-Forwarded-For is honoured.
  TRUST_PROXY: z.string().min(1).optional(),
  // Base64 32-byte key for AES-256-GCM contact-number encryption.
  CONTACT_ENCRYPTION_KEY: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  // Never ship to production with plaintext contact numbers.
  if (value.NODE_ENV === "production" && !value.CONTACT_ENCRYPTION_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CONTACT_ENCRYPTION_KEY"],
      message: "CONTACT_ENCRYPTION_KEY is required in production",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    logger.error({ fieldErrors: parsed.error.flatten().fieldErrors }, "Invalid environment variables");
    throw new Error("Environment validation failed");
  }
  cached = parsed.data;
  return cached;
}
