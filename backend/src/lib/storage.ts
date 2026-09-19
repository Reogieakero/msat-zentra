import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../config/env.js";
import { AppError } from "./errors.js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const env = getEnv();
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY);
  return client;
}

/**
 * Bucket resolution.
 *
 * - SF10 files            -> SF10_STORAGE_BUCKET   (fallback: STORAGE_BUCKET)
 * - Clinic / referral session documentation
 *                         -> REFERRAL_STORAGE_BUCKET / CLINIC_STORAGE_BUCKET
 *                            (fallback: STORAGE_BUCKET)
 *
 * Separate env vars let Supabase hold two buckets (e.g. `sf10-docs` and
 * `referral-docs`) with different RLS / lifecycle rules instead of mixing
 * everything into one `zentra-docs` bucket.
 */
export function getSf10Bucket(): string {
  const env = getEnv();
  return env.SF10_STORAGE_BUCKET ?? env.STORAGE_BUCKET;
}

export function getReferralBucket(): string {
  const env = getEnv();
  return env.REFERRAL_STORAGE_BUCKET ?? env.CLINIC_STORAGE_BUCKET ?? env.STORAGE_BUCKET;
}

async function ensureBucketExists(bucket: string): Promise<void> {
  const c = getClient();
  const { data, error } = await c.storage.listBuckets();
  if (!error && data?.some((b) => b.name === bucket)) return;
  // Bucket missing (or list failed) — try to create it. Requires the
  // service-role key; if creation fails the original upload error below
  // is still surfaced with the bucket name.
  const { error: createError } = await c.storage.createBucket(bucket, { public: true });
  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    console.error(`[storage] auto-create bucket "${bucket}" failed:`, createError.message);
  }
}

function isBucketNotFound(message: string): boolean {
  return /bucket not found|bucketnotfound|no such bucket|does not exist/i.test(message);
}

/**
 * Upload a buffer to Supabase Storage and return the public URL.
 */
export async function uploadFile(
  buffer: Buffer,
  path: string,
  contentType: string,
  bucket?: string,
): Promise<string> {
  const c = getClient();
  const targetBucket = bucket ?? getEnv().STORAGE_BUCKET;

  let { error } = await c.storage
    .from(targetBucket)
    .upload(path, buffer, { contentType, upsert: true });

  if (error && isBucketNotFound(error.message)) {
    // First upload in a fresh Supabase project hits this when the bucket
    // was never created in Dashboard > Storage. Auto-create once and retry
    // so session documentation doesn't 500 with "Internal server error".
    console.warn(`[storage] bucket "${targetBucket}" not found — creating it and retrying path "${path}"`);
    await ensureBucketExists(targetBucket);
    ({ error } = await c.storage
      .from(targetBucket)
      .upload(path, buffer, { contentType, upsert: true }));
  }

  if (error) {
    console.error(`[storage] upload failed (bucket="${targetBucket}" path="${path}"):`, error.message);
    throw new AppError(
      502,
      "STORAGE_ERROR",
      `File upload failed (bucket "${targetBucket}"): ${error.message}. ` +
        `Create the "${targetBucket}" bucket in Supabase Dashboard > Storage (public) and retry.`,
    );
  }
  const { data } = c.storage.from(targetBucket).getPublicUrl(path);
  return data.publicUrl;
}

export function sf10ObjectPath(studentId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "pdf";
  return `sf10/${studentId}-${Date.now()}.${safeExt}`;
}

export function clinicSessionObjectPath(sessionId: string, originalName: string): string {
  const ext = (originalName.split(".").pop() ?? "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `clinic/${sessionId}-${Date.now()}.${ext}`;
}
