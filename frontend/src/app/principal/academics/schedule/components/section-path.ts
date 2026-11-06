/**
 * Section URLs read as the section name instead of a database id:
 * `/principal/academics/schedule/einstein-g7`. The grade suffix keeps two
 * same-named sections (allowed across grade levels) apart. Legacy UUID links
 * still resolve — `findSectionByRef` accepts either form.
 */

export function sectionSlug(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

function gradeNumber(gradeLevel: string): string {
  return gradeLevel.replace(/\D/g, "");
}

/** Human-readable schedule desk path for a section. */
export function sectionPath(section: { name: string; gradeLevel: string }): string {
  const grade = gradeNumber(section.gradeLevel);
  return `/principal/academics/schedule/${sectionSlug(section.name)}${grade ? `-g${grade}` : ""}`;
}

/**
 * Resolve a URL segment back to a section. Accepts `einstein`, `einstein-g7`
 * or a raw section id (old links / notification deep-links).
 */
export function findSectionByRef<T extends { id: string; name: string; gradeLevel: string }>(
  sections: T[],
  ref: string,
): T | null {
  const raw = decodeURIComponent(ref ?? "").trim();
  if (!raw) return null;

  const byId = sections.find((s) => s.id === raw);
  if (byId) return byId;

  const match = /^(.*?)(?:-g(\d{1,2}))?$/i.exec(raw);
  const namePart = sectionSlug(match?.[1] ?? raw);
  const gradePart = match?.[2] ?? null;

  if (gradePart) {
    const exact = sections.find(
      (s) => sectionSlug(s.name) === namePart && gradeNumber(s.gradeLevel) === gradePart,
    );
    if (exact) return exact;
  }

  // Bare name (or the grade suffix didn't match) — first section wins.
  return sections.find((s) => sectionSlug(s.name) === namePart) ?? null;
}
