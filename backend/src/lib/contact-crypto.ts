import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "../config/env.js";
import { logger } from "./pino.js";

/**
 * Contact numbers must stay readable (admin queues show them), so they are
 * encrypted with AES-256-GCM instead of hashed. Values carry a `v1:` marker so
 * `decryptContact` can also read rows written before encryption existed.
 */
const PREFIX = "v1";

let cachedKey: Buffer | null | undefined;

/**
 * `CONTACT_ENCRYPTION_KEY` is a base64 32-byte key. Anything else is folded to
 * 32 bytes with SHA-256 so a short dev passphrase still works; production is
 * forced to set the variable by the env schema.
 */
function encryptionKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = getEnv().CONTACT_ENCRYPTION_KEY?.trim();
  if (!raw) {
    logger.warn(
      "CONTACT_ENCRYPTION_KEY is not set — contact numbers are stored in plaintext (set it before production).",
    );
    cachedKey = null;
    return cachedKey;
  }
  const decoded = Buffer.from(raw, "base64");
  cachedKey = decoded.length === 32 ? decoded : createHash("sha256").update(raw).digest();
  return cachedKey;
}

/** Empty input stays null; output is `v1:<iv>:<tag>:<ciphertext>` (base64 parts). */
export function encryptContact(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const key = encryptionKey();
  if (!key) return trimmed;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  return [
    PREFIX,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Tolerates legacy plaintext rows (no `v1:` marker) and returns null on failure. */
export function decryptContact(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncryptedContact(value)) return value;

  const key = encryptionKey();
  if (!key) return null;

  const [, ivB64, tagB64, dataB64] = value.split(":");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    logger.warn("Contact number could not be decrypted (wrong CONTACT_ENCRYPTION_KEY?).");
    return null;
  }
}

export function isEncryptedContact(value: string | null | undefined): boolean {
  return !!value && value.startsWith(`${PREFIX}:`);
}
