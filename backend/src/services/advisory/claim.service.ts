import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { writeAudit } from "../../lib/audit.js";
import { gradeToNumber } from "../../modules/teacher/teacher.repository.js";
import { matchesAdviserCode, normalizeAdviserCode } from "../../modules/academics/adviserCode.js";
import { matchesAdviserName } from "../../modules/teacher/advisory.repository.js";
import type { AdvisoryContext } from "./advisory.types.js";

export async function getClaimStatus(ctx: AdvisoryContext, yearId: string | null) {
  const teacherId = ctx.userId;
  if (!yearId) return { alreadyAdvising: [], claimable: [] };

  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { fullName: true },
  });
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found");

  const [advised, candidates] = await Promise.all([
    prisma.section.findMany({
      where: { schoolYearId: yearId, adviserId: teacherId },
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      select: { id: true, name: true, gradeLevel: true, schoolYearId: true },
    }),
    prisma.section.findMany({
      where: { schoolYearId: yearId, adviserId: null },
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      select: { id: true, name: true, gradeLevel: true, adviserLabel: true, adviserCode: true },
    }),
  ]);

  return {
    alreadyAdvising: advised.map((s) => ({
      id: s.id,
      name: s.name,
      gradeLevel: gradeToNumber(s.gradeLevel),
      schoolYearId: s.schoolYearId,
    })),
    claimable: candidates
      .map((s) => ({
        id: s.id,
        name: s.name,
        gradeLevel: gradeToNumber(s.gradeLevel),
        adviserLabel: (s as { adviserLabel?: string | null }).adviserLabel ?? "",
        suggested: matchesAdviserName(
          (s as { adviserLabel?: string | null }).adviserLabel,
          teacher.fullName,
        ),
        hasCode: !!((s as { adviserCode?: string | null }).adviserCode ?? null),
      }))
      .sort(
        (a, b) =>
          Number(b.suggested) - Number(a.suggested) ||
          a.gradeLevel - b.gradeLevel ||
          a.name.localeCompare(b.name),
      ),
  };
}

export interface ClaimInput {
  sectionId: string;
  code?: string;
}

export async function claimSection(ctx: AdvisoryContext, input: ClaimInput, yearId: string | null) {
  const teacherId = ctx.userId;
  const sectionId = input.sectionId;
  if (!sectionId?.trim()) throw new AppError(400, "MISSING_FIELDS", "sectionId is required");

  const [teacher, section] = await Promise.all([
    prisma.user.findUnique({ where: { id: teacherId }, select: { fullName: true } }),
    prisma.section.findUnique({
      where: { id: sectionId.trim() },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        schoolYearId: true,
        adviserId: true,
        adviserLabel: true,
        adviserCode: true,
        schoolYear: { select: { name: true } },
      },
    }),
  ]);
  if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found");
  if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
  if (yearId && section.schoolYearId !== yearId) {
    throw new AppError(403, "SCOPE_MISMATCH", "Section is outside the active school year");
  }

  if (section.adviserId === teacherId) {
    return {
      id: section.id,
      name: section.name,
      gradeLevel: gradeToNumber(section.gradeLevel),
      adviserId: teacherId,
      alreadyClaimed: true,
    };
  }
  const row = section as typeof section & {
    adviserLabel?: string | null;
    adviserCode?: string | null;
  };

  if (row.adviserLabel) {
    const entered = normalizeAdviserCode(input.code);
    if (!entered) {
      throw new AppError(
        400,
        "CODE_REQUIRED",
        `Section "${section.name}" is listed under "${row.adviserLabel}" — enter the advisory code from your principal.`,
      );
    }
    if (!matchesAdviserCode(row.adviserCode, entered)) {
      throw new AppError(
        403,
        "CODE_MISMATCH",
        "Wrong advisory code — ask your principal for the current code for this section.",
      );
    }
  }

  const claimed = await prisma.section.updateMany({
    where: {
      id: section.id,
      adviserId: null,
      ...(row.adviserCode ? { adviserCode: row.adviserCode } : {}),
    },
    data: { adviserId: teacherId, adviserCode: null },
  });
  if (claimed.count === 0) {
    throw new AppError(
      409,
      "SECTION_ALREADY_CLAIMED",
      `Section "${section.name}" was just claimed by someone else.`
    );
  }

  await prisma.staffProfile.updateMany({
    where: { userId: teacherId },
    data: { isAdviser: true },
  });
  await writeAudit({
    userId: teacherId,
    actionType: "update",
    sourceTable: "sections",
    sourceId: section.id,
    reason: "Teacher claimed advisory section (self-onboarding)",
  });
  return {
    id: section.id,
    name: section.name,
    gradeLevel: gradeToNumber(section.gradeLevel),
    adviserId: teacherId,
    alreadyClaimed: false,
  };
}

export interface ReleaseClaimInput {
  sectionId: string | null;
}

export async function releaseClaim(ctx: AdvisoryContext, input: ReleaseClaimInput, yearId: string | null) {
  const teacherId = ctx.userId;
  const trimmed = input.sectionId?.trim() || null;

  const yearFilter = yearId ? { schoolYearId: yearId } : {};

  let released: { id: string; name: string }[] = [];
  if (trimmed) {
    const owned = await prisma.section.findFirst({
      where: { id: trimmed, adviserId: teacherId, ...yearFilter },
      select: { id: true, name: true },
    });
    if (!owned) {
      throw new AppError(404, "NOT_ADVISER", "You are not the adviser of this section");
    }
    await prisma.section.updateMany({
      where: { id: owned.id, adviserId: teacherId, ...yearFilter },
      data: { adviserId: null, adviserCode: null },
    });
    released = [{ id: owned.id, name: owned.name }];
  } else {
    const owned = await prisma.section.findMany({
      where: { adviserId: teacherId, ...yearFilter },
      select: { id: true, name: true },
    });
    if (owned.length === 0) {
      return { released: [], isAdviser: false };
    }
    await prisma.section.updateMany({
      where: { adviserId: teacherId, ...yearFilter },
      data: { adviserId: null, adviserCode: null },
    });
    released = owned.map((s) => ({ id: s.id, name: s.name }));
  }

  const remaining = await prisma.section.count({ where: { adviserId: teacherId } });
  await prisma.staffProfile.updateMany({
    where: { userId: teacherId },
    data: { isAdviser: remaining > 0 },
  });
  for (const s of released) {
    await writeAudit({
      userId: teacherId,
      actionType: "update",
      sourceTable: "sections",
      sourceId: s.id,
      reason: "Teacher released advisory section (Settings)",
    });
  }

  return { released, isAdviser: remaining > 0 };
}
