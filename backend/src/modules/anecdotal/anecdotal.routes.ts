import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";

const router = Router();

const createSchema = z.object({
  studentId: z.string().min(1),
  sectionId: z.string().min(1),
  termId: z.string().min(1),
  observationDatetime: z.string().datetime(),
  descriptionOfIncident: z.string().min(1),
  descriptionOfLocation: z.string().optional(),
  notesRecommendationsActions: z.string().optional(),
  classPerformance: z.string().optional(),
  attendanceSummary: z.string().optional(),
  category: z.enum(["behavioral", "bullying", "academic", "attendance", "health"]).default("behavioral"),
  confidentialityLevel: z.enum(["restricted", "confidential"]).default("restricted"),
});
router.post(
  "/",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  validate("body", createSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.create({
        data: { ...req.body, observationDatetime: new Date(req.body.observationDatetime), observerId: req.user!.id },
      });
      await writeAudit({ userId: req.user!.id, actionType: "anecdotal_edit", sourceTable: "anecdotal_records", sourceId: record.id, reason: "Anecdotal record created" });
      res.status(201).json(record);
    } catch (e) { next(e); }
  }
);

const followupSchema = z.object({ notes: z.string().min(1) });
router.post(
  "/:id/followups",
  requireAuth,
  requireRole("adviser", "guidance_counselor", "nurse", "adm_coordinator", "principal"),
  validate("body", followupSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.findUnique({ where: { id: String(req.params.id) } });
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const followup = await prisma.anecdotalRecordFollowup.create({
        data: { anecdotalRecordId: record.id, followupBy: req.user!.id, followupDate: new Date(), notes: req.body.notes },
      });
      await fanoutNotification({
        userId: record.observerId, sourceTable: "anecdotal_record_followups", action: "create",
        message: "New follow-up added to an anecdotal record.", sourceId: followup.id,
      });
      res.status(201).json(followup);
    } catch (e) { next(e); }
  }
);

const referSchema = z.object({
  referredToRole: z.enum(["nurse", "guidance_counselor", "adm_coordinator", "principal"]),
  reason: z.string().min(1),
  termId: z.string().min(1),
});
router.post(
  "/:id/refer",
  requireAuth,
  requireRole("adviser"),
  validate("body", referSchema),
  async (req, res, next) => {
    try {
      const record = await prisma.anecdotalRecord.findUnique({ where: { id: String(req.params.id) } });
      if (!record) throw new AppError(404, "NOT_FOUND", "Anecdotal record not found");
      const referral = await prisma.referral.create({
        data: { anecdotalRecordId: record.id, referredToRole: req.body.referredToRole, referredBy: req.user!.id, reason: req.body.reason, studentId: record.studentId, termId: req.body.termId },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Referred to ${req.body.referredToRole}` });
      res.status(201).json(referral);
    }   catch (e) { next(e); }
  }
);

const CATEGORY_KEYS = ["behavioral", "bullying", "academic", "attendance", "health"] as const;

const CATEGORY_META: Record<
  string,
  { label: string; color: string }
> = {
  behavioral: { label: "Behavioral", color: "#166534" },
  bullying: { label: "Bullying", color: "#b91c1c" },
  academic: { label: "Academic", color: "#1d4ed8" },
  attendance: { label: "Attendance", color: "#c2410c" },
  health: { label: "Health", color: "#7c3aed" },
};

// Principal: records heatmap source — every section with its students that have
// anecdotal records, including each record's category/severity/follow-up. The
// categories returned here are the canonical backend AnecdotalCategory enum, so
// the heatmap legend and block colors stay wired to the backend.
router.get(
  "/records",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true, schoolYearId: true },
      });
      const termId = activeTerm?.id;
      const schoolYear = activeTerm
        ? ((await prisma.schoolYear.findUnique({
            where: { id: activeTerm.schoolYearId },
            select: { name: true },
          }))?.name ?? "")
        : "";
      const where = termId ? { termId } : {};

      const [sections, records] = await Promise.all([
        prisma.section.findMany({
          where: termId ? { schoolYearId: activeTerm!.schoolYearId } : {},
          orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            gradeLevel: true,
            students: {
              select: {
                userId: true,
                lrn: true,
                user: { select: { fullName: true, status: true } },
              },
            },
          },
        }),
        prisma.anecdotalRecord.findMany({
          where,
          select: {
            id: true,
            studentId: true,
            sectionId: true,
            observationDatetime: true,
            descriptionOfIncident: true,
            notesRecommendationsActions: true,
            category: true,
            confidentialityLevel: true,
            observer: { select: { fullName: true } },
            followups: { orderBy: { followupDate: "desc" }, take: 1, select: { id: true } },
            referrals: { take: 1, orderBy: { id: "desc" }, select: { status: true } },
          },
        }),
      ]);

      const recordByStudent = new Map<string, typeof records>();
      for (const r of records) {
        const arr = recordByStudent.get(r.studentId) ?? [];
        arr.push(r);
        recordByStudent.set(r.studentId, arr);
      }

      const dataSections = sections
        .map((section) => {
          const students = section.students
            .map((st) => {
              const recs = recordByStudent.get(st.userId);
              if (!recs || recs.length === 0) return null;
              return {
                lrn: st.lrn,
                name: st.user.fullName,
                status: st.user.status,
                gradeLevel: section.gradeLevel,
                section: section.name,
                sectionId: section.id,
                behavioral: recs.map((r) => ({
                  id: r.id,
                  date: r.observationDatetime.toISOString().slice(0, 10),
                  category: r.category,
                  description: r.descriptionOfIncident,
                  severity:
                    r.referrals[0]?.status === "resolved"
                      ? "Low"
                      : r.confidentialityLevel === "confidential"
                        ? "High"
                        : "Moderate",
                  staff: r.observer.fullName,
                  resolution: r.notesRecommendationsActions ?? "",
                  followUp: r.referrals[0]?.status === "resolved"
                    ? "Resolved"
                    : r.followups.length > 0
                      ? "Monitoring"
                      : "Pending",
                })),
              };
            })
            .filter((s): s is NonNullable<typeof s> => s !== null);
          if (students.length === 0) return null;
          return {
            sectionId: section.id,
            section: section.name,
            gradeLevel: section.gradeLevel,
            students,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      res.json({
        schoolYear,
        sections: dataSections,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/summary",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const activeTerm = await prisma.term.findFirst({
        where: { schoolYear: { isActive: true } },
        orderBy: { termNumber: "asc" },
        select: { id: true },
      });
      const termId = activeTerm?.id;
      const where = termId ? { termId } : {};

      const [counts, recent] = await Promise.all([
        prisma.anecdotalRecord.groupBy({
          by: ["category"],
          where,
          _count: { _all: true },
        }),
        prisma.anecdotalRecord.findMany({
          where,
          orderBy: { observationDatetime: "desc" },
          take: 5,
          select: {
            id: true,
            category: true,
            observationDatetime: true,
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                section: { select: { name: true } },
                user: { select: { fullName: true } },
              },
            },
            observer: { select: { fullName: true } },
          },
        }),
      ]);

      const categories = CATEGORY_KEYS.map((key) => ({
        key,
        label: CATEGORY_META[key]?.label ?? key,
        color: CATEGORY_META[key]?.color ?? "#64748b",
        value: counts.find((c) => c.category === key)?._count._all ?? 0,
      }));

      const total = categories.reduce((s, c) => s + c.value, 0);

      const GRADE_LABEL: Record<string, string> = {
        G7: "Grade 7",
        G8: "Grade 8",
        G9: "Grade 9",
        G10: "Grade 10",
        G11: "Grade 11",
        G12: "Grade 12",
      };

      const students = recent.map((r) => ({
        id: r.id,
        lrn: r.student.lrn,
        section: r.student.section?.name ?? "",
        year: GRADE_LABEL[r.student.gradeLevel] ?? r.student.gradeLevel,
        dateAdded: r.observationDatetime.toISOString().slice(0, 10),
        adviser: r.observer.fullName,
      }));

      res.json({ categories, total, students });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
