import { toSlug } from "./slug";

/**
 * URL segment for a section in the schedule template route
 * (`/teacher/schedule/template/<section>`).
 *
 * Normally just the slug of the section name ("Einstein" → "einstein"). When
 * another section shares that name (names are only unique per grade band), the
 * grade is appended ("einstein-g7") so the URL never resolves to the wrong
 * class. `all` should be the list the link is rendered from.
 */
export function sectionSlug(
  name: string,
  gradeLevel: string | null | undefined,
  all: { name: string }[],
): string {
  const base = toSlug(name);
  const duplicated = all.filter((s) => toSlug(s.name) === base).length > 1;
  return duplicated && gradeLevel ? `${base}-${gradeLevel.toLowerCase()}` : base;
}

/** Reverse of `sectionSlug` — accepts both the plain and grade-suffixed form. */
export function matchSectionSlug<T extends { name: string; gradeLevel: string | null }>(
  segment: string,
  list: T[],
): T | null {
  const wanted = toSlug(decodeURIComponent(segment));
  if (!wanted) return null;
  const plain = list.filter((s) => toSlug(s.name) === wanted);
  if (plain.length === 1) return plain[0]!;
  const graded = list.filter(
    (s) => s.gradeLevel && `${toSlug(s.name)}-${s.gradeLevel.toLowerCase()}` === wanted,
  );
  if (graded.length > 0) return graded[0]!;
  return plain.length > 1 ? (plain[0] ?? null) : null;
}
