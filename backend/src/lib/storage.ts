import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../config/env.js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const env = getEnv();
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY);
  return client;
}

/**
 * Upload a buffer to Supabase Storage and return the public URL.
 * Falls back to a deterministic placeholder path if storage is unreachable so
 * the record row is still created (storage misconfig is surfaced via logs).
 */
export async function uploadFile(
  buffer: Buffer,
  path: string,
  contentType: string,
): Promise<string> {
  const env = getEnv();
  const c = getClient();
  const { error } = await c.storage
    .from(env.STORAGE_BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) {
    console.error("[storage] SF10 upload failed:", error.message);
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  const { data } = c.storage.from(env.STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function sf10ObjectPath(studentId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "pdf";
  return `sf10/${studentId}-${Date.now()}.${safeExt}`;
}
