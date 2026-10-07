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
      // Transactions are always saved under the session's active term —
      // the client never picks a term per action.
      const termId = req.termScope?.termId ?? bodyTermId;
      const ctx = {
        userId: req.user!.id,
        role: req.user!.role,
        termId,
        schoolYearId: req.termScope?.schoolYearId ?? null,
      };

      // Subject path (new model) vs legacy AM/PM path (frozen behavior).
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
        // Attendance stats feed cached overview/teacher pages; recomputes
        // above can open guidance interventions + risk levels.
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
        // The section adviser learns in realtime (toast + bell) that per-subject
        // attendance landed — best-effort, never delays this response.
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
            // Logged inside fanoutNotification; never throws outward.
          }
        })();
        return;
      }

      // ---- Legacy AM/PM path (adviser-only, unchanged) ----
      const result = await submitLegacyBulk(ctx, {
        sectionId,
        termId,
        date,
        session,
        records,
      });
      // Attendance stats feed cached overview/teacher pages; recomputes
      // above can open guidance interventions + risk levels.
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
    } catch (e) {
      next(e);
    }
  }
);

// Manual auto-absent sweep: materialize absent rows for elapsed subject
// meetups the teacher never took (same run the hourly job performs).
// Principal-gated; idempotent — re-runs create nothing new.
router.post(
  "/sweep-absent",
  requireAuth,
  requireRole("principal"),
  async (_req, res, next) => {
    try {
      const result = await sweepAutoAbsent();
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
