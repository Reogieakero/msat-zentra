import { randomInt } from "node:crypto";

export const ADVISER_CODE_PREFIX = "ADV-";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function mintAdviserCode(): string {
  let suffix = "";
  for (let i = 0; i < 5; i += 1) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${ADVISER_CODE_PREFIX}${suffix}`;
}

export function normalizeAdviserCode(code: string | null | undefined): string {
  return String(code ?? "").trim().toUpperCase();
}

export function matchesAdviserCode(
  storedCode: string | null | undefined,
  enteredCode: string | null | undefined,
): boolean {
  const stored = normalizeAdviserCode(storedCode);
  const entered = normalizeAdviserCode(enteredCode);
  if (!stored || !entered) return false;
  return stored === entered;
}
