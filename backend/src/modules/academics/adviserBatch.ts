import { AppError } from "../../lib/errors.js";

/** Max rows per advisory batch request (single transactional mutation). */
export const MAX_ADVISER_BATCH = 20;

export interface AdviserBatchInputRow {
  /** Resolved id when the client already knows the record, else null. */
  sectionId: string | null;
  /** Typed section name (used when sectionId is absent). */
  sectionName: string | null;
  /** Grade 7–12 (required alongside sectionName). */
  gradeLevel: number | null;
  /** Resolved id when known, else null. */
  adviserId: string | null;
  /** Typed teacher name (used when adviserId is absent). Null = clear. */
  adviserName: string | null;
}

/**
 * Pure normalization for the principal advisory batch endpoint.
 * Trims inputs, maps empty adviser references to null (clear), enforces the
 * batch cap, and dedupes by section (id, else grade+name — last entry wins).
 * Name→record resolution happens against the database in the route, so the
 * client's cached list is never the source of truth. Throws AppError on bad
 * input so the route fails fast before touching the database.
 */
export function normalizeAdviserBatch(assignments: unknown): AdviserBatchInputRow[] {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw new AppError(400, "MISSING_FIELDS", "assignments must be a non-empty array");
  }
  if (assignments.length > MAX_ADVISER_BATCH) {
    throw new AppError(
      400,
      "BATCH_TOO_LARGE",
      `At most ${MAX_ADVISER_BATCH} assignments per request`
    );
  }
  type Raw = {
    sectionId?: unknown;
    sectionName?: unknown;
    gradeLevel?: unknown;
    adviserId?: unknown;
    adviserName?: unknown;
  };
  const bySection = new Map<string, AdviserBatchInputRow>();
  for (const a of assignments as Raw[]) {
    const sectionId = String(a?.sectionId ?? "").trim() || null;
    const sectionName = String(a?.sectionName ?? "").trim() || null;
    const gradeRaw = a?.gradeLevel;
    const gradeLevel =
      gradeRaw === undefined || gradeRaw === null || String(gradeRaw).trim() === ""
        ? null
        : Number(gradeRaw);
    const adviserId = a?.adviserId == null || String(a.adviserId).trim() === "" ? null : String(a.adviserId).trim();
    const adviserName = a?.adviserName == null || String(a.adviserName).trim() === "" ? null : String(a.adviserName).trim();

    if (!sectionId && !sectionName) {
      throw new AppError(400, "MISSING_FIELDS", "Every assignment needs a section (id or name)");
    }
    let grade: number | null = null;
    if (!sectionId) {
      if (gradeLevel == null || !Number.isInteger(gradeLevel) || gradeLevel < 7 || gradeLevel > 12) {
        throw new AppError(400, "INVALID_GRADE_LEVEL", "Grade level must be 7–12 when assigning by section name");
      }
      grade = gradeLevel;
    }
    const key = sectionId ?? `n:${grade}:${sectionName!.toLowerCase()}`;
    // Last entry wins per section.
    bySection.set(key, { sectionId, sectionName, gradeLevel: grade, adviserId, adviserName });
  }
  return [...bySection.values()];
}
