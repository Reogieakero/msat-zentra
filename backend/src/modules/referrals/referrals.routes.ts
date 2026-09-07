import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { ADM_STAGE_FLOW } from "../../services/adm.js";

const router = Router();

const statusSchema = z.object({ status: z.enum(["pending", "in_progress", "resolved"]) });
router.post(
  "/:id/status",
  requireAuth,
  requireRole("guidance_counselor", "nurse", "adm_coordinator", "principal"),
  validate("body", statusSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: String(req.params.id) } });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.status === req.body.status) return res.json(referral);
      const updated = await prisma.referral.update({
        where: { id: referral.id },
        data: { status: req.body.status },
      });
      await writeAudit({ userId: req.user!.id, actionType: "referral_status_change", sourceTable: "referrals", sourceId: referral.id, reason: `Status → ${req.body.status}`, oldValue: { status: referral.status }, newValue: { status: req.body.status } });
      res.json(updated);
    } catch (e) { next(e); }
  }
);

router.get(
  "/",
  requireAuth,
  requireRole("guidance_counselor", "nurse", "adm_coordinator", "principal"),
  async (req, res, next) => {
    try {
      const referrals = await prisma.referral.findMany({ include: { anecdotalRecord: true, student: true }, orderBy: { id: "asc" } });
      res.json(referrals);
    } catch (e) { next(e); }
  }
);

// Teacher-scoped referrals: returns referrals where the teacher is the referrer
// (referredBy = me), narrowed to their advisory sections' students. Adviser-only
// (404 if the teacher has no advisory section). Subject teachers may also read
// referrals they originated (PLANS/teacher-referrals.md §4.4).
router.get(
  "/mine",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sections = await prisma.section.findMany({
        where: { adviserId: teacherId },
        select: { id: true, name: true, gradeLevel: true },
      });
      if (sections.length === 0 && req.user!.role === "adviser") {
        throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
      }
      const sectionIds = sections.map((s) => s.id);
      const referralWhere = {
        referredBy: teacherId,
        ...(sectionIds.length > 0
          ? { student: { sectionId: { in: sectionIds } } }
          : {}),
      };
      const referrals = await prisma.referral.findMany({
        where: referralWhere,
        include: {
          student: {
            select: {
              lrn: true,
              user: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          anecdotalRecord: {
            select: {
              id: true,
              observationDatetime: true,
              category: true,
              confidentialityLevel: true,
              descriptionOfIncident: true,
              notesRecommendationsActions: true,
            },
          },
          // Real follow-through evidence (status-only for teachers — no
          // clinical text leaves this endpoint).
          homeVisitations: { select: { id: true } },
          admProfiles: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              stage: true,
              eligibilityStatus: true,
              approvedBy: true,
              approvedAt: true,
              createdAt: true,
              parentMeetings: {
                orderBy: { meetingDatetime: "desc" },
                take: 5,
                select: { attended: true, meetingDatetime: true },
              },
            },
          },
        },
        orderBy: { id: "desc" },
      });

      const referralIds = referrals.map((r) => r.id);
      const auditEntries = await prisma.auditLog.findMany({
        where: {
          sourceTable: "referrals",
          sourceId: { in: referralIds },
        },
        orderBy: { createdAt: "asc" },
      });
      const logsByReferral = new Map<string, { createdAt: Date; reason: string | null }[]>();
      for (const log of auditEntries) {
        const list = logsByReferral.get(log.sourceId) ?? [];
        list.push({ createdAt: log.createdAt, reason: (log as { reason?: string | null }).reason ?? null });
        logsByReferral.set(log.sourceId, list);
      }

      const admLabelByStage = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));

      const formatted = referrals.map((r) => {
        const isAdm = r.referredToRole === "adm_coordinator";
        const profile = r.admProfiles[0] ?? null;
        const meetings = profile?.parentMeetings ?? [];
        const hasParentMeeting = meetings.length > 0;
        const meetingAttended = meetings.length > 0 ? meetings.some((m) => m.attended) : null;
        const hasHomeVisit = r.homeVisitations.length > 0;
        // Canonical ADM stage enum (anecdotal → … → completion). A fresh ADM
        // referral with no profile yet sits at consultation.
        const admStage = isAdm ? (profile?.stage ?? "consultation") : null;

        const logs = logsByReferral.get(r.id) ?? [];
        const referredAt = logs[0]?.createdAt.toISOString() ?? new Date().toISOString();
        const timeline = logs.map((l) => ({
          label: l.reason ?? "Referral update",
          date: l.createdAt.toISOString().slice(0, 10),
        }));
        if (timeline.length === 0) {
          timeline.push({
            label: `Referred to ${r.referredToRole}`,
            date: referredAt.slice(0, 10),
          });
        }
        if (profile) {
          timeline.push({
            label: `ADM stage: ${admLabelByStage.get(profile.stage) ?? profile.stage}`,
            date: profile.createdAt.toISOString().slice(0, 10),
          });
        }
        if (profile?.approvedBy && profile.approvedAt) {
          timeline.push({
            label: "Principal approval signed",
            date: profile.approvedAt.toISOString().slice(0, 10),
          });
        }

        return {
          id: r.id,
          studentName: r.student.user.fullName,
          lrn: r.student.lrn,
          section: r.student.section?.name ?? "",
          targetRole: r.referredToRole,
          referredBy: r.referredBy,
          reason: r.reason,
          status: r.status,
          referredAt,
          resolvedAt: r.status === "resolved" ? (logs[logs.length - 1]?.createdAt.toISOString() ?? new Date().toISOString()) : null,
          anecdotalId: r.anecdotalRecordId,
          observationDate: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
          anecdotalExcerpt: r.anecdotalRecord.descriptionOfIncident,
          category: r.anecdotalRecord.category,
          track: isAdm ? "adm" : "general",
          admReceiver: isAdm ? "adm_coordinator" : null,
          hasParentMeeting,
          meetingAttended,
          hasHomeVisit,
          admStage,
          admStageLabel: admStage ? (admLabelByStage.get(admStage) ?? admStage) : null,
          admEligibility: profile?.eligibilityStatus ?? null,
          admApproved: !!profile?.approvedBy,
          admApprovedAt: profile?.approvedAt ? profile.approvedAt.toISOString() : null,
          timeline,
        };
      });

      res.json(formatted);
    } catch (e) { next(e); }
  }
);

export default router;
