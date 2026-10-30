import { toSlug } from "./slug";

/**
 * Human-readable gradebook URL segment: subject + section, e.g.
 * "Edukasyon sa Pagpapakatao 7" + "Newton" → "edukasyon-sa-pagpapakatao-7-newton".
 *
 * The workspace page resolves this against the teacher's class list (overview),
 * which is where the internal `${subjectId}|${sectionId}` class id lives. Keep
 * the two in sync — the overview row is the single source of truth.
 */
export function gradebookSlug(row: { subject: string; section: string }): string {
  return toSlug(`${row.subject} ${row.section}`);
}
