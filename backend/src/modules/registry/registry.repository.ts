import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import {
  GRADE_BAND_7_10 as BAND_7_10,
  GRADE_BAND_11_12 as BAND_11_12,
  roleGradeBand as roleBand,
} from "../../lib/roles.js";
import {
  GRADE_LABELS as LABELS,
  gradeLabel as labelFor,
  gradeToNumber as toNumber,
} from "../../lib/grades.js";

export const GRADE_BAND_7_10 = BAND_7_10;
export const GRADE_BAND_11_12 = BAND_11_12;

export function roleGradeBand(role?: string): GradeLevel[] {
  return roleBand(role);
}

export function schoolYearClause(schoolYearId: string | null):
  | { schoolYearId: string }
  | { schoolYear: { isActive: boolean } } {
  return schoolYearId ? { schoolYearId } : { schoolYear: { isActive: true } };
}

export const GRADE_LABELS = LABELS;

export function gradeLabel(gradeLevel: string): string {
  return labelFor(gradeLevel);
}

export function gradeToNumber(gradeLevel: GradeLevel | string): number {
  return toNumber(gradeLevel);
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

  if (requested?.trim()) {
    for (const candidate of yearCandidates(requested)) {
      const found = await prisma.schoolYear.findFirst({ where: { name: candidate } });
      if (found) return found;
    }
  } else if (activeYear) {
    return activeYear;
  }

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

  await prisma.term.createMany({
    data: [1, 2, 3].map((termNumber) => ({ schoolYearId: created.id, termNumber })),
    skipDuplicates: true,
  });
  return created;
}
