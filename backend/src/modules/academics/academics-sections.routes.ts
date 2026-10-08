import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { writeAudit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";
import { gradeToNumber } from "../../lib/grades.js";
import { assertInScope, resolveScopeYear, toGradeEnum } from "./academics-shared.js";

const router = Router();

router.post(
  "/assign/sections",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const { name, gradeLevel } = req.body as { name?: string; gradeLevel?: number };
      if (!name?.trim()) throw new AppError(400, "MISSING_NAME", "Section name is required");
      const gl = toGradeEnum(Number(gradeLevel));
      const scopeYear = await resolveScopeYear(req);

      const duplicate = await prisma.section.findFirst({
        where: { name: name.trim(), gradeLevel: gl, schoolYearId: scopeYear.id },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError(
          409,
          "DUPLICATE_SECTION",
          `Section "${name.trim()}" already exists for Grade ${gradeToNumber(gl)} in ${scopeYear.name}`
        );
      }

      const section = await prisma.section.create({
        data: { name: name.trim(), gradeLevel: gl, schoolYearId: scopeYear.id, adviserId: null },
        include: { schoolYear: { select: { id: true, name: true } } },
      });

      await writeAudit({
        userId: req.user!.id,
        actionType: "create",
        sourceTable: "sections",
        sourceId: section.id,
        reason: "Principal created section",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.status(201).json({
        id: section.id,
        name: section.name,
        gradeLevel: gradeToNumber(section.gradeLevel),
        schoolYear: section.schoolYear?.name ?? scopeYear.name,
        schoolYearId: section.schoolYearId,
        adviserId: "",
        adviserName: "",
        assignments: [],
      });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/assign/sections/:id",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const section = await prisma.section.findUnique({
        where: { id },
        select: { id: true, name: true, schoolYearId: true },
      });
      if (!section) throw new AppError(404, "SECTION_NOT_FOUND", "Section not found");
      assertInScope(req, section.schoolYearId);

      const [students, roster, assignments, attendance, anecdotal, flags, sf10] =
        await Promise.all([
          prisma.studentProfile.count({ where: { sectionId: id } }),
          prisma.studentRoster.count({ where: { sectionId: id } }),
          prisma.teacherSubjectAssignment.count({ where: { sectionId: id } }),
          prisma.attendanceRecord.count({ where: { sectionId: id } }),
          prisma.anecdotalRecord.count({ where: { sectionId: id } }),
          prisma.gradeFlag.count({ where: { sectionId: id } }),
          prisma.adviserSf10AccessRequest.count({ where: { sectionId: id } }),
        ]);
      const linked = students + roster + assignments + attendance + anecdotal + flags + sf10;
      if (linked > 0) {
        const parts: string[] = [];
        if (students + roster > 0) parts.push("students");
        if (assignments > 0) parts.push("teacher assignments");
        if (attendance + anecdotal + flags > 0) parts.push("records");
        if (sf10 > 0) parts.push("SF10 access requests");
        throw new AppError(
          409,
          "SECTION_HAS_RECORDS",
          `Cannot delete "${section.name}" — it still has ${parts.join(", ")}. Clear or reassign them first.`
        );
      }

      await prisma.section.delete({ where: { id } });
      await writeAudit({
        userId: req.user!.id,
        actionType: "delete",
        sourceTable: "sections",
        sourceId: id,
        reason: "Principal deleted section",
      });
      await invalidateTags(["academics", "principal", "registrar", "overview"]);

      res.json({ id, deleted: true });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
