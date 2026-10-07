import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type { GradeLevel } from "../../generated/prisma/client.js";

// Shared records-desk data-access: grade-band policy, labels, grade-number
// mapping, subject category labels, and school-year resolution. Used by both
// the registrar (G11–12) and record-keeper (G7–10) desks. Endpoint
// orchestration lives in src/services/registry/*.service.ts.

// Authority is grade-banded by role: Record Keeper owns junior high (7–10),
// Registrar owns senior high (11–12).
export const GRADE_BAND_7_10: GradeLevel[] = ["G7", "G8", "G9", "G10"];
export const GRADE_BAND_11_12: GradeLevel[] = ["G11", "G12"];

// Same shape for both desks so one endpoint serves each role with data
// scoped to its own band.
export function roleGradeBand(role?: string): GradeLevel[] {
  return role === "record_keeper" ? GRADE_BAND_7_10 : GRADE_BAND_11_12;
}

// Section scoping for the session's active school year (same rule as
// schoolYearWhere in lib/termScope, without taking the request).
export function schoolYearClause(schoolYearId: string | null):
  | { schoolYearId: string }
  | { schoolYear: { isActive: boolean } } {
  return schoolYearId ? { schoolYearId } : { schoolYear: { isActive: true } };
}

export const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

export function gradeLabel(gradeLevel: string): string {
  return GRADE_LABELS[gradeLevel] ?? gradeLevel;
}

// Grade code → number for every band (G7→7 … G12→12). Inputs are always
// GradeLevel enums from the database, so digit parsing matches both desks'
// previous mappings exactly.
export function gradeToNumber(gradeLevel: GradeLevel | string): number {
  const m = String(gradeLevel).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

export function toGradeLevel(band: GradeLevel[], n: number): GradeLevel {
  const code = `G${n}` as GradeLevel;
  if (!band.includes(code)) {
    throw new AppError(
      400,
      "INVALID_GRADE_LEVEL",
      `Grade level must be ${band.map((g) => g.slice(1)).join(" or ")}`,
    );
  }
  return code;
}

type SubjectCategoryLabel = "Core" | "Elective";

export function toCategoryLabel(category: string): SubjectCategoryLabel {
  return category === "ELECTIVE" ? "Elective" : "Core";
}

export function parseCategory(raw: unknown): "CORE" | "ELECTIVE" {
  if (raw == null || String(raw).trim() === "") return "CORE";
  const norm = String(raw).trim().toLowerCase();
  if (norm === "core") return "CORE";
  if (norm === "elective") return "ELECTIVE";
  throw new AppError(400, "INVALID_CATEGORY", "Category must be Core or Elective");
}

// Normalize a school-year label so frontend values like "2026–2027" (en dash,
// no prefix) match stored rows like "SY 2026-2027".
function normalizeYearLabel(raw: string): string {
  return raw.trim().replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

function yearCandidates(raw: string): string[] {
  const norm = normalizeYearLabel(raw);
  const withoutPrefix = norm.replace(/^SY\s+/i, "");
  return [norm, `SY ${withoutPrefix}`, withoutPrefix];
}

export async function resolveSchoolYear(requested?: string) {
  const activeYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  // Try to match the requested label (exact + prefix variants).
  if (requested?.trim()) {
    for (const candidate of yearCandidates(requested)) {
      const found = await prisma.schoolYear.findFirst({ where: { name: candidate } });
      if (found) return found;
    }
  } else if (activeYear) {
    return activeYear;
  }

  // No match: auto-provision instead of 409 so section creation never fails
  // just because the year table is empty or uses a different label format.
  const baseLabel = requested?.trim() ? normalizeYearLabel(requested) : activeYear?.name;
  const name = baseLabel
    ? baseLabel.match(/^\d{4}-\d{4}$/)
      ? `SY ${baseLabel}`
      : baseLabel
    : `SY ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  if (activeYear && !requested?.trim()) return activeYear;

  const existing = await prisma.schoolYear.findFirst({ where: { name } });
  if (existing) return existing;

  const yearMatch = name.match(/(\d{4})\D(\d{4})/);
  const startY = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
  const endY = yearMatch ? Number(yearMatch[2]) : startY + 1;
  const created = await prisma.schoolYear.create({
    data: {
      name,
      startDate: new Date(`${startY}-06-15T00:00:00Z`),
      endDate: new Date(`${endY}-03-31T00:00:00Z`),
      isActive: activeYear ? false : true,
      createdBy: "system",
    },
    select: { id: true, name: true },
  });
  // Every school year needs terms 1-3 or later assignment creation 404s.
  await prisma.term.createMany({
    data: [1, 2, 3].map((termNumber) => ({ schoolYearId: created.id, termNumber })),
    skipDuplicates: true,
  });
  return created;
}
