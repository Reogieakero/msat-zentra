import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { cache, invalidateTags } from "../../lib/cache.js";
import { validate } from "../../middleware/validate.js";
import { writeAudit } from "../../lib/audit.js";
import { fanoutNotification } from "../../lib/notify.js";
import { ADM_STAGE_FLOW, ADM_STAGES, canTransition, evaluateAdmEligibility, type AdmStage } from "../../services/adm.js";

const router = Router();

router.get(
  "/pipeline",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  async (_req, res) => {
    res.json({ stages: ADM_STAGES, flow: ADM_STAGE_FLOW });
  }
);


router.get(
  "/dashboard",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm"] }),
  async (_req, res, next) => {
    try {
      const profiles = await prisma.admLearnerProfile.findMany({
        include: {
          student: { include: { user: true } },
          preparedByUser: true,
          forms: { orderBy: { uploadedAt: "desc" } },
        },
        orderBy: { id: "desc" },
      });

      const stageBreakdown = ADM_STAGE_FLOW.map((s) => ({
        stage: s.stage,
        short: s.label,
        count: profiles.filter((p) => p.stage === s.stage).length,
      }));

      // Gate matches isAwaitingSignature() on the frontend so the KPI only
      // counts cases the sign action can actually act on.
      const pendingSignature = profiles.filter(
        (p) =>
          !p.approvedBy &&
          p.eligibilityStatus === "eligible" &&
          p.stage === "principal_approval"
      ).length;
      const signed = profiles.filter((p) => p.approvedBy).length;

      const ACTIVE_STAGES = [
        "meeting_parents",
        "home_visitation",
        "certification",
        "principal_approval",
      ];

      const latestReferred = profiles
        .filter((p) => ACTIVE_STAGES.includes(p.stage))
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          lrn: p.student.lrn,
          student: p.student.user.fullName,
          grade: GRADE_LABEL[p.student.gradeLevel] ?? p.student.gradeLevel,
          stage: p.stage as
            | "meeting_parents"
            | "home_visitation"
            | "certification"
            | "principal_approval",
          eligibilityStatus: p.eligibilityStatus,
          preparedBy: p.preparedByUser.fullName,
          datePrepared: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : null,
          approvedBy: p.approvedBy ? "Principal" : null,
          forms: p.forms.map((f) => ({
            id: f.id,
            formType: f.formType,
            title: f.title,
            status: f.status,
            uploadedAt: f.uploadedAt,
          })),
        }));

      res.json({
        kpis: { pendingSignature, signed, active: profiles.length },
        stageBreakdown,
        latestReferred,
      });
    } catch (e) {
      next(e);
    }
  }
);

const GRADE_LABEL: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

const ELIGIBILITY_LABEL: Record<string, string> = {
  pending: "For Review",
  eligible: "Eligible",
  ineligible: "Ineligible",
};

const PAGE_SIZE = 20;

const REFERRAL_STAGES: AdmStage[] = [
  "meeting_parents",
  "home_visitation",
  "certification",
  "principal_approval",
];

router.get(
  "/referrals/all",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = PAGE_SIZE;
      const skip = (page - 1) * limit;
      const q =
        typeof req.query.q === "string" && req.query.q.trim()
          ? req.query.q.trim().toLowerCase()
          : "";
      const stageParam =
        typeof req.query.stage === "string" && req.query.stage.trim()
          ? req.query.stage.trim()
          : "";
      const stageFilter: AdmStage | "" =
        stageParam && REFERRAL_STAGES.includes(stageParam as AdmStage)
          ? (stageParam as AdmStage)
          : "";

      const where: Prisma.AdmLearnerProfileWhereInput = {
        ...(stageFilter ? { stage: stageFilter } : { stage: { in: REFERRAL_STAGES } }),
        ...(q
          ? {
              OR: [
                { student: { user: { fullName: { contains: q, mode: "insensitive" as const } } } },
                { student: { lrn: { contains: q } } },
                { id: { contains: q } },
              ],
            }
          : {}),
      };

      const referredWhere: Prisma.AdmLearnerProfileWhereInput = { stage: { in: REFERRAL_STAGES } };
      const [pageItems, total, stageGroups, totalReferred] = await Promise.all([
        prisma.admLearnerProfile.findMany({
          where,
          include: {
            student: { include: { user: true } },
            preparedByUser: true,
            forms: { orderBy: { uploadedAt: "desc" }, take: 8 },
          },
          orderBy: { id: "desc" },
          skip,
          take: limit,
        }),
        prisma.admLearnerProfile.count({ where }),
        prisma.admLearnerProfile.groupBy({
          by: ["stage"],
          where: referredWhere,
          _count: { _all: true },
        }),
        prisma.admLearnerProfile.count({ where: referredWhere }),
      ]);

      const countsByStage: Record<string, number> = {};
      for (const g of stageGroups) countsByStage[g.stage] = g._count?._all ?? 0;

      const out = pageItems.map((p) => {
        const stage = p.stage;
        const base = {
          id: p.id,
          lrn: p.student.lrn,
          student: p.student.user.fullName,
          grade: GRADE_LABEL[p.student.gradeLevel] ?? p.student.gradeLevel,
          stage,
          eligibilityStatus:
            p.eligibilityStatus === "eligible"
              ? ("eligible" as const)
              : p.eligibilityStatus === "ineligible"
              ? ("ineligible" as const)
              : ("pending" as const),
          preparedBy: p.preparedByUser.fullName,
          datePrepared: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : null,
          approvedBy: p.approvedBy ? "Principal" : null,
          approvalDate: p.approvedAt ? p.approvedAt.toISOString().slice(0, 10) : null,
          forms: p.forms.map((f) => ({
            id: f.id,
            formType: f.formType,
            title: f.title,
            status: f.status,
          })),
        };
        // Principal: status-only — strip confidential fields
        return req.user!.role === "principal" ? base : { ...base, studentId: p.studentId };
      });

      res.json({
        rows: out,
        total,
        totalReferred,
        stageCounts: countsByStage,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        limit,
      });
    } catch (e) { next(e); }
  }
);

router.get(
  "/approvals",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = PAGE_SIZE;
      const skip = (page - 1) * limit;
      const q =
        typeof req.query.q === "string" && req.query.q.trim()
          ? req.query.q.trim().toLowerCase()
          : "";

      const profiles = await prisma.admLearnerProfile.findMany({
        where: { approvedBy: { not: null } },
        include: {
          student: { include: { user: true } },
          approvedByUser: true,
          preparedByUser: true,
          forms: { orderBy: { uploadedAt: "desc" } },
        },
        orderBy: { approvedAt: "desc" },
      });

      const filtered = q
        ? profiles.filter(
            (p) =>
              p.student.user.fullName.toLowerCase().includes(q) ||
              p.student.lrn.toLowerCase().includes(q) ||
              p.id.toLowerCase().includes(q) ||
              (p.approvedByUser?.fullName ?? "").toLowerCase().includes(q)
          )
        : profiles;
      const total = filtered.length;
      const pageItems = filtered.slice(skip, skip + limit);

      const out = pageItems.map((p) => {
        const base = {
          id: p.id,
          lrn: p.student.lrn,
          student: p.student.user.fullName,
          grade: GRADE_LABEL[p.student.gradeLevel] ?? p.student.gradeLevel,
          section: p.student.sectionId ?? "",
          eligibilityStatus:
            p.eligibilityStatus === "eligible"
              ? ("eligible" as const)
              : p.eligibilityStatus === "ineligible"
              ? ("ineligible" as const)
              : ("pending" as const),
          preparedBy: p.preparedByUser.fullName,
          approvedBy: p.approvedByUser?.fullName ?? "Principal",
          approvalDate: p.approvedAt ? p.approvedAt.toISOString().slice(0, 10) : null,
          forms: p.forms.map((f) => ({
            id: f.id,
            formType: f.formType,
            title: f.title,
            status: f.status,
          })),
        };
        return req.user!.role === "principal" ? base : { ...base, studentId: p.studentId };
      });

      res.json({
        rows: out,
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        limit,
      });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/referrals",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm"] }),
  async (req, res, next) => {
    try {
      const profiles = await prisma.admLearnerProfile.findMany({
        include: {
          student: { include: { user: true } },
          preparedByUser: true,
        },
        orderBy: { id: "asc" },
      });
      const out = profiles.map((p) => {
        const signed = !!p.approvedBy;
        const base = {
          id: p.id,
          lrn: p.student.lrn,
          student: p.student.user.fullName,
          grade: GRADE_LABEL[p.student.gradeLevel] ?? p.student.gradeLevel,
          status: signed ? "signed" : "pending_signature",
          eligibility: ELIGIBILITY_LABEL[p.eligibilityStatus] ?? p.eligibilityStatus,
          preparedBy: p.preparedByUser.fullName,
        };
        // Principal: status-only — strip confidential fields
        return req.user!.role === "principal" ? base : { ...base, studentId: p.studentId };
      });
      res.json(out);
    } catch (e) { next(e); }
  }
);

const profileSchema = z.object({
  studentId: z.string().min(1),
  referralId: z.string().min(1),
  termId: z.string().min(1),
  certificationDetails: z.record(z.any()).optional(),
});
router.post(
  "/profiles",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", profileSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({ where: { id: req.body.referralId } });
      if (!referral) throw new AppError(404, "REFERRAL_NOT_FOUND", "Referral required for ADM profile");
      const profile = await prisma.admLearnerProfile.create({
        data: { ...req.body, preparedBy: req.user!.id },
      });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_learner_profiles", sourceId: profile.id, reason: "ADM learner profile created" });
      await fanoutNotification({ userId: req.user!.id, sourceTable: "adm_learner_profiles", action: "certify", message: "ADM profile ready for principal signature.", sourceId: profile.id });
      await invalidateTags(["adm", "overview", "principal"]);
      res.status(201).json(profile);
    } catch (e) { next(e); }
  }
);

router.post(
  "/:id/principal-approve",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const profile = await prisma.admLearnerProfile.findUnique({ where: { id: String(req.params.id) } });
      if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
      if (profile.approvedBy) throw new AppError(409, "ALREADY_APPROVED", "Already signed by principal");
      if (profile.eligibilityStatus !== "eligible")
        throw new AppError(409, "NOT_CERTIFIED", "Case must pass Recommendation & Certification before School Head approval");
      if (profile.stage !== "principal_approval")
        throw new AppError(409, "NOT_AT_SCHOOL_HEAD", "Case must be at School Head (Principal) Approval before signing");
      const updated = await prisma.admLearnerProfile.update({
        where: { id: profile.id },
        data: { approvedBy: req.user!.id, approvedAt: new Date(), stage: "enrollment_monitoring" },
      });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_learner_profiles", sourceId: profile.id, reason: "Principal final signature", oldValue: { approvedBy: null }, newValue: { approvedBy: req.user!.id } });
      await invalidateTags(["adm", "overview", "principal"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

const deviceIssueSchema = z.object({
  admLearnerProfileId: z.string().min(1),
  deviceType: z.string().min(1),
  deviceSerial: z.string().min(1),
  issuedDate: z.string().datetime().optional(),
  conditionNotes: z.string().optional(),
});
router.post(
  "/:id/principal-return",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const profile = await prisma.admLearnerProfile.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
      if (!profile.approvedBy)
        throw new AppError(409, "NOT_YET_APPROVED", "Cannot return a profile that has not been signed");
      const updated = await prisma.admLearnerProfile.update({
        where: { id: profile.id },
        data: {
          approvedBy: null,
          approvedAt: null,
          eligibilityStatus: "pending",
          stage: "principal_approval",
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "adm_edit",
        sourceTable: "adm_learner_profiles",
        sourceId: profile.id,
        reason: "Principal returned profile to ADM Coordinator for revision",
        oldValue: { approvedBy: profile.approvedBy, eligibilityStatus: profile.eligibilityStatus },
        newValue: { approvedBy: null, eligibilityStatus: "pending" },
      });
      await fanoutNotification({
        userId: req.user!.id,
        sourceTable: "adm_learner_profiles",
        action: "return",
        message: "ADM profile returned by principal for revision.",
        sourceId: profile.id,
      });
      await invalidateTags(["adm", "overview", "principal"]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

const ROLE_FOR_STAGE: Record<AdmStage, string[]> = {
  anecdotal: ["adviser"],
  consultation: ["guidance_counselor", "nurse"],
  meeting_parents: ["adm_coordinator"],
  home_visitation: ["guidance_counselor"],
  certification: ["adm_coordinator"],
  principal_approval: ["principal"],
  enrollment_monitoring: ["adm_coordinator"],
  completion: ["adm_coordinator"],
};

const advanceSchema = z.object({
  stage: z.enum(ADM_STAGES as [AdmStage, ...AdmStage[]]),
});

router.patch(
  "/:id/stage",
  requireAuth,
  validate("body", advanceSchema),
  async (req, res, next) => {
    try {
      const profile = await prisma.admLearnerProfile.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
      const target = req.body.stage as AdmStage;
      if (profile.stage === target) {
        res.json(profile);
        return;
      }
      if (!canTransition(profile.stage, target)) {
        throw new AppError(
          409,
          "ADM_INVALID_TRANSITION",
          `Cannot move from ${profile.stage} to ${target}`
        );
      }
      const allowed = ROLE_FOR_STAGE[target] ?? [];
      if (!allowed.includes(req.user!.role)) {
        throw new AppError(
          403,
          "FORBIDDEN_STAGE",
          `Role ${req.user!.role} cannot move a case to ${target}`
        );
      }
      // Eligibility is derived from the documented evidence chain. Recompute it
      // whenever a case enters (or passes) the certification stage so the
      // Reports/ADM eligibility buckets stay accurate without manual tagging.
      const data: { stage: AdmStage; eligibilityStatus?: "pending" | "eligible" | "ineligible" } = {
        stage: target,
      };
      if (
        target === "certification" ||
        target === "principal_approval" ||
        target === "enrollment_monitoring" ||
        target === "completion"
      ) {
        const full = await prisma.admLearnerProfile.findUnique({
          where: { id: profile.id },
          select: {
            stage: true,
            forms: { select: { formType: true, status: true } },
            parentMeetings: { select: { attended: true } },
          },
        });
        if (full) {
          data.eligibilityStatus = evaluateAdmEligibility({
            stage: target,
            forms: full.forms,
            parentMeetings: full.parentMeetings,
          });
        }
      } else {
        // Moving back before certification resets eligibility to pending.
        data.eligibilityStatus = "pending";
      }
      const updated = await prisma.admLearnerProfile.update({
        where: { id: profile.id },
        data,
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "adm_edit",
        sourceTable: "adm_learner_profiles",
        sourceId: profile.id,
        reason: `ADM stage advanced to ${target}`,
        oldValue: { stage: profile.stage },
        newValue: { stage: target },
      });
      await invalidateTags(["adm", "overview", "principal"]);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/devices/issue",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", deviceIssueSchema),
  async (req, res, next) => {
    try {
      const device = await prisma.admDevice.create({
        data: { ...req.body, issuedBy: req.user!.id, issuedDate: req.body.issuedDate ? new Date(req.body.issuedDate) : new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_devices", sourceId: device.id, reason: "ADM device issued" });
      await invalidateTags(["adm", "overview", "principal"]);
      res.status(201).json(device);
    } catch (e) { next(e); }
  }
);

const deviceReturnSchema = z.object({ returnedDate: z.string().datetime().optional() });
router.post(
  "/devices/:id/return",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", deviceReturnSchema),
  async (req, res, next) => {
    try {
      const device = await prisma.admDevice.findUnique({ where: { id: String(req.params.id) } });
      if (!device) throw new AppError(404, "NOT_FOUND", "Device not found");
      if (device.returnedDate) throw new AppError(409, "ALREADY_RETURNED", "Device already returned");
      const updated = await prisma.admDevice.update({ where: { id: device.id }, data: { returnedDate: req.body.returnedDate ? new Date(req.body.returnedDate) : new Date() } });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_devices", sourceId: device.id, reason: "ADM device returned" });
      await invalidateTags(["adm", "overview", "principal"]);
      res.json(updated);
    } catch (e) { next(e); }
  }
);

export default router;
