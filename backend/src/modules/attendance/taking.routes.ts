import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { invalidateTags } from "../../lib/cache.js";
import { fanoutNotification } from "../../lib/notify.js";
import { validate } from "../../middleware/validate.js";
import { prisma } from "../../lib/prisma.js";
import { sweepAutoAbsent } from "../../services/autoAbsent.js";
import { bulkSchema } from "./attendance.schemas.js";
import { submitLegacyBulk, submitSubjectBulk } from "../../services/attendance/taking.service.js";

const router = Router();

router.post(
  "/bulk",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", bulkSchema),
  async (req, res, next) => {
    try {
      const { sectionId, termId: bodyTermId, date, subjectId, assignmentId, slot, session, records } =
        req.body as {
          sectionId: string;
          termId: string;
          date: string;
          subjectId?: string;
          assignmentId?: string;
          slot?: number;
          session?: "AM" | "PM";
          records: { studentId: string; status: "present" | "absent" | "late" | "excused" }[];
        };

      const termId = req.termScope?.termId ?? bodyTermId;
      const ctx = {
        userId: req.user!.id,
        role: req.user!.role,
        termId,
        schoolYearId: req.termScope?.schoolYearId ?? null,
      };

      if (subjectId) {
        const result = await submitSubjectBulk(ctx, {
          sectionId,
          termId,
          subjectId,
          assignmentId,
          slot: slot ?? 1,
          date,
          records,
        });

        await invalidateTags(["overview", "principal", "teacher", "risk", "reports", "guidance"]);

        res.status(201).json({ count: result.count, subjectId, slot: slot ?? 1 });
        for (const ping of result.parentPings) {
          void fanoutNotification({
            userId: ping.userId,
            sourceTable: ping.sourceTable,
            action: ping.action,
            sourceId: ping.sourceId,
            message: ping.message,
          });
        }

        void (async () => {
          try {
            const section = await prisma.section.findUnique({
              where: { id: result.adviserNotice.sectionId },
              select: { name: true, adviserId: true },
            });
            if (section?.adviserId && section.adviserId !== ctx.userId) {
              await fanoutNotification({
                userId: section.adviserId,
                sourceTable: "attendance_records",
                action: "subject_submit",
                sourceId: result.adviserNotice.sectionId,
                message: `${result.adviserNotice.count} attendance marks for ${result.adviserNotice.subjectLabel} (${section.name}, ${result.adviserNotice.recordDay} slot ${result.adviserNotice.slot}) were submitted.`,
              });
            }
          } catch {

          }
        })();
        return;
      }

      const result = await submitLegacyBulk(ctx, {
        sectionId,
        termId,
        date,
        session,
        records,
      });

      await invalidateTags(["overview", "principal", "teacher", "risk", "guidance", "reports"]);

      res.status(201).json({ count: result.count });
      for (const ping of result.parentPings) {
        void fanoutNotification({
          userId: ping.userId,
          sourceTable: ping.sourceTable,
          action: ping.action,
          sourceId: ping.sourceId,
          message: ping.message,
        });
      }
      void fanoutNotification({
        userId: ctx.userId,
        sourceTable: "attendance_records",
        action: "create",
        sourceId: `${sectionId}|${(req.body as { date?: string }).date ?? ""}|${(req.body as { session?: string }).session ?? "AM"}`,
        message: `You saved advisory attendance for ${result.count} students.`,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/sweep-absent",
  requireAuth,
  requireRole("principal"),
  async (_req, res, next) => {
    try {
      const result = await sweepAutoAbsent();
      res.json(result);
      void (async () => {
        try {
          const { prisma } = await import("../../lib/prisma.js");
          const { fanoutNotification } = await import("../../lib/notify.js");
          if ((result.rows ?? 0) > 0) {
            const sections = await prisma.section.findMany({ where: { adviserId: { not: null } }, select: { id: true, name: true, adviserId: true } });
            for (const s of sections) {
              if (!s.adviserId) continue;
              await fanoutNotification({
                userId: s.adviserId,
                sourceTable: "attendance_records",
                action: "sweep",
                message: `Auto-absent sweep marked ${result.rows} absent marks across ${result.meetups} class meetups — check ${s.name} for updates.`,
                sourceId: s.id,
              });
            }
          }
        } catch { /* best-effort */ }
      })();
    } catch (e) {
      next(e);
    }
  }
);

export default router;
