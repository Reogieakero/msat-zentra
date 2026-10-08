import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";
import { normalizeAdviserBatch, type AdviserBatchInputRow } from "./adviserBatch.js";
import { assertInScope, mintUniqueAdviserCode, resolveScopeYear, toAdviserResult, toGradeEnum } from "./academics-shared.js";

const router = Router();

async function resolveBatchSections(
  rows: AdviserBatchInputRow[],
  scopeYearId: string,
): Promise<string[]> {
  const sectionIds = new Array<string>(rows.length);
  const nameHitByRow = new Map<AdviserBatchInputRow, string>();
  const idRows = rows.filter((r) => r.sectionId);
  const nameRows = rows.filter((r) => !r.sectionId);

  const byIdPromise = (async () => {
    const byId = new Map<string, string>();
    if (idRows.length === 0) return byId;
    const ids = [...new Set(idRows.map((r) => r.sectionId as string))];
    const found = await prisma.section.findMany({
      where: { id: { in: ids } },
      select: { id: true, schoolYearId: true },
    });
    if (found.length !== ids.length) {
      throw new AppError(404, "SECTION_NOT_FOUND", "One or more sections were not found");
    }
    for (const s of found) {
      if (s.schoolYearId !== scopeYearId) {
        throw new AppError(403, "SCOPE_MISMATCH", "One or more sections are outside the active school year");
      }
      byId.set(s.id, s.id);
    }
    return byId;
  })();

  const byNamePromise = (async () => {
    if (nameRows.length === 0) return;
    const grades = [...new Set(nameRows.map((r) => toGradeEnum(r.gradeLevel!)))];
    const candidates = await prisma.section.findMany({
      where: { schoolYearId: scopeYearId, gradeLevel: { in: grades } },
      select: { id: true, name: true, gradeLevel: true },
    });
    for (const r of nameRows) {
      const typed = r.sectionName!.trim();
      const wantGrade = toGradeEnum(r.gradeLevel!);
      const pool = candidates.filter((s) => s.gradeLevel === wantGrade);
      const hit =
        pool.find((s) => s.name === typed) ??
        pool.find((s) => s.name.trim().toLowerCase() === typed.toLowerCase());
      if (!hit) {
        throw new AppError(
          404,
          "SECTION_NOT_FOUND",
          `No section named "${typed}" in Grade ${r.gradeLevel}.`
        );
      }
      nameHitByRow.set(r, hit.id);
    }
  })();

  const [byId] = await Promise.all([byIdPromise, byNamePromise]);
  rows.forEach((r, i) => {
    sectionIds[i] = r.sectionId ? byId.get(r.sectionId)! : nameHitByRow.get(r)!;
  });
  return sectionIds;
}

async function resolveBatchTeachers(rows: AdviserBatchInputRow[]): Promise<{
  teacherForRow: (string | null)[];
  labelForRow: (string | null)[];
}> {
  const teacherForRow = new Array<string | null>(rows.length).fill(null);
  const labelForRow = new Array<string | null>(rows.length).fill(null);
  const idIdx = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.adviserId);
  const nameIdx = rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.adviserId && r.adviserName);
  const byIdPromise = (async () => {
    const byId = new Map<string, string>();
    if (idIdx.length === 0) return byId;
    const ids = [...new Set(idIdx.map(({ r }) => r.adviserId as string))];
    const found = await prisma.user.findMany({
      where: { id: { in: ids }, role: { in: ["subject_teacher", "adviser"] }, status: "active" },
      select: { id: true, fullName: true },
    });
    if (found.length !== ids.length) {
      throw new AppError(404, "TEACHER_NOT_FOUND", "One or more teachers were not found or are not active");
    }
    for (const t of found) byId.set(t.id, t.fullName);
    return byId;
  })();
  const byNamePromise = (async () => {
    const byName = new Map<string, { id: string; fullName: string }[]>();
    if (nameIdx.length === 0) return byName;
    const nameKeys = [...new Set(nameIdx.map(({ r }) => r.adviserName!.trim().toLowerCase()))];
    const found = await prisma.user.findMany({
      where: {
        fullName: { in: nameKeys, mode: "insensitive" },
        role: { in: ["subject_teacher", "adviser"] },
        status: "active",
      },
      select: { id: true, fullName: true },
    });
    for (const t of found) {
      const k = t.fullName.trim().toLowerCase();
      const list = byName.get(k) ?? [];
      list.push(t);
      byName.set(k, list);
    }
    return byName;
  })();
  const [byId, byName] = await Promise.all([byIdPromise, byNamePromise]);
  for (const { r, i } of idIdx) {
    teacherForRow[i] = r.adviserId as string;
    labelForRow[i] = byId.get(r.adviserId as string) ?? null;
  }
  for (const { r, i } of nameIdx) {
    const typed = r.adviserName!.trim();
    const candidates = byName.get(typed.toLowerCase()) ?? [];
    const hit =
      candidates.find((c) => c.fullName === typed) ??
      (candidates.length === 1 ? candidates[0] : undefined);
    teacherForRow[i] = hit?.id ?? null;
    labelForRow[i] = typed;
  }
  return { teacherForRow, labelForRow };
}

router.patch(
  "/assign/sections/advisers",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const { assignments } = req.body as {
        assignments?: {
          sectionId?: string;
          sectionName?: string;
          gradeLevel?: number;
          adviserId?: string | null;
          adviserName?: string;
        }[];
      };
      const rows = normalizeAdviserBatch(assignments);
      const scopeYearPromise = resolveScopeYear(req);
      const teacherPromise = resolveBatchTeachers(rows);
      const sectionPromise = scopeYearPromise.then((sy) => resolveBatchSections(rows, sy.id));
      const [sectionIds, { labelForRow }] = await Promise.all([
        sectionPromise,
        teacherPromise,
      ]);

      const minted = new Set<string>();
      const codeForRow: (string | null)[] = [];
      for (const label of labelForRow) {
        if (label) codeForRow.push(await mintUniqueAdviserCode(minted));
        else codeForRow.push(null);
      }

      const updated = await prisma.$transaction(
        sectionIds.map((sectionId, i) =>
          prisma.section.update({
            where: { id: sectionId },
            data: {
              adviserId: null,
              adviserLabel: labelForRow[i],
              adviserCode: codeForRow[i],
            },
            include: {
              adviser: { select: { id: true, fullName: true } },
              schoolYear: { select: { id: true, name: true } },
            },
          })
        )
      );

      await Promise.allSettled(
        updated.map((u) =>
          writeAudit({
            userId: req.user!.id,
            actionType: "update",
            sourceTable: "sections",
            sourceId: u.id,
            reason: (u as { adviserLabel?: string | null }).adviserLabel
              ? "Principal assigned section adviser + code (batch)"
              : "Principal cleared section adviser (batch)",
          })
        )
      );
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.json({ updated: updated.map(toAdviserResult) });
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/assign/sections/:id/adviser",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { adviserId, adviserName } = req.body as {
        adviserId?: string | null;
        adviserName?: string | null;
      };

      const trimmedId =
        adviserId == null || String(adviserId).trim() === "" ? null : String(adviserId).trim();
      const trimmedName =
        adviserName == null || String(adviserName).trim() === "" ? null : String(adviserName).trim();

      const [section, teacher] = await Promise.all([
        prisma.section.findUnique({ where: { id } }),
        trimmedId
          ? prisma.user.findFirst({
              where: {
                id: trimmedId,
                role: { in: ["subject_teacher", "adviser"] },
                status: "active",
              },
              select: { id: true, fullName: true },
            })
          : Promise.resolve(null),
      ]);
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      assertInScope(req, section.schoolYearId);

      let nextLabel: string | null = null;
      if (trimmedId) {
        if (!teacher) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found or not active");
        nextLabel = teacher.fullName;
      } else if (trimmedName) {
        nextLabel = trimmedName;
      }
      const nextCode = nextLabel ? await mintUniqueAdviserCode() : null;

      const updated = await prisma.section.update({
        where: { id },
        data: { adviserId: null, adviserLabel: nextLabel, adviserCode: nextCode },
        include: {
          adviser: { select: { id: true, fullName: true } },
          schoolYear: { select: { id: true, name: true } },
        },
      });

      await writeAudit({
        userId: req.user!.id,
        actionType: "update",
        sourceTable: "sections",
        sourceId: updated.id,
        reason: nextLabel
          ? "Principal assigned section adviser + code"
          : "Principal cleared section adviser",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.json(toAdviserResult(updated));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/assign/sections/:id/adviser-code/regenerate",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const section = await prisma.section.findUnique({ where: { id } });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      assertInScope(req, section.schoolYearId);
      const row = section as typeof section & {
        adviserLabel?: string | null;
        adviserId?: string | null;
      };
      if (row.adviserId) {
        throw new AppError(
          409,
          "ALREADY_CLAIMED",
          "This section is already claimed — codes are single-use and rotate on the next assignment.",
        );
      }
      if (!row.adviserLabel) {
        throw new AppError(
          400,
          "NO_ADVISER_LISTED",
          "List an adviser first — regeneration needs a pending assignment.",
        );
      }
      const nextCode = await mintUniqueAdviserCode();
      const updated = await prisma.section.update({
        where: { id },
        data: { adviserCode: nextCode },
        include: {
          adviser: { select: { id: true, fullName: true } },
          schoolYear: { select: { id: true, name: true } },
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "update",
        sourceTable: "sections",
        sourceId: updated.id,
        reason: "Principal regenerated advisory code",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);
      res.json(toAdviserResult(updated));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
