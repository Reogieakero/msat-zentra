/**
 * URL-safe slug for a person's display name.
 * "Ma. Juana Dela Cruz" → "ma-juana-dela-cruz".
 * Mirrors `caseSlug` in the backend ADM monitoring service — keep them in sync.
 */
export function toSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
