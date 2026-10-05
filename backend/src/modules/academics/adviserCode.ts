import { randomInt } from "node:crypto";

/** Prefix for principal-minted advisory claim codes (e.g. ADV-7K2Q9). */
export const ADVISER_CODE_PREFIX = "ADV-";

/** Ambiguous glyphs excluded so codes survive hand-copying (no 0/O, 1/I). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Pure code mint: ADV- + 5 unambiguous alphanumerics.
 * Uniqueness against the DB is handled by the caller (retry on collision,
 * same pattern as TeacherName MS-101 codes).
 */
export function mintAdviserCode(): string {
  let suffix = "";
  for (let i = 0; i < 5; i += 1) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${ADVISER_CODE_PREFIX}${suffix}`;
}

/** Normalize user-entered codes for comparison: trim + uppercase. */
export function normalizeAdviserCode(code: string | null | undefined): string {
  return String(code ?? "").trim().toUpperCase();
}

/**
 * Pure verification: entered code matches the stored section code.
 * Case-insensitive + trim-tolerant so hand-copied codes ("adv-7k2q9")
 * verify. Pure so it stays unit-testable without a DB.
 */
export function matchesAdviserCode(
  storedCode: string | null | undefined,
  enteredCode: string | null | undefined,
): boolean {
  const stored = normalizeAdviserCode(storedCode);
  const entered = normalizeAdviserCode(enteredCode);
  if (!stored || !entered) return false;
  return stored === entered;
}
