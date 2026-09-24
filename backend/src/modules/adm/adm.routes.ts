import { Router } from "express";
import { z } from "zod";
import argon2 from "argon2";
import crypto from "crypto";
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
      const ACTIVE_STAGES: AdmStage[] = [
        "meeting_parents",
        "home_visitation",
        "certification",
        "principal_approval",
      ];

      // Aggregated counts (no full-table fetch) + a small top-5 for the
      // activity list. Filed referrals awaiting a learner profile sit at
      // consultation.
      const [
        stageGroups,
        earlyConsultation,
        pendingSignature,
        signed,
        totalProfiles,
        needsRevision,
        totalReferredProfiles,
        issuedDevices,
        returnedDevices,
        latestProfiles,
      ] = await Promise.all([
        prisma.admLearnerProfile.groupBy({
          by: ["stage"],
          _count: { _all: true },
        }),
        prisma.referral.count({
          where: { referredToRole: "adm_coordinator", admProfiles: { none: {} } },
        }),
        // Gate matches isAwaitingSignature() on the frontend so the KPI only
        // counts cases the sign action can actually act on.
        prisma.admLearnerProfile.count({
          where: {
            stage: "principal_approval",
            approvedBy: null,
            eligibilityStatus: "eligible",
          },
        }),
        prisma.admLearnerProfile.count({
          where: { approvedBy: { not: null } },
        }),
        prisma.admLearnerProfile.count(),
        prisma.admLearnerProfile.count({
          where: {
            stage: "principal_approval",
            approvedBy: null,
            eligibilityStatus: { not: "eligible" },
          },
        }),
        prisma.admLearnerProfile.count({
          where: { stage: { in: ACTIVE_STAGES } },
        }),
        prisma.admDevice.count({ where: { returnedDate: null } }),
        prisma.admDevice.count({ where: { returnedDate: { not: null } } }),
        prisma.admLearnerProfile.findMany({
          where: { stage: { in: ACTIVE_STAGES } },
          include: {
            student: { include: { user: true } },
            preparedByUser: true,
            forms: { orderBy: { uploadedAt: "desc" } },
          },
          orderBy: { id: "desc" },
          take: 5,
        }),
      ]);

      const countsByStage = new Map(
        stageGroups.map((g) => [g.stage, g._count._all]),
      );
      const stageBreakdown = ADM_STAGE_FLOW.map((s) => ({
        stage: s.stage,
        short: s.label,
        count:
          (countsByStage.get(s.stage) ?? 0) +
          (s.stage === "consultation" ? earlyConsultation : 0),
      }));

      const latestReferred = latestProfiles.map((p) => ({
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
        kpis: { pendingSignature, signed, active: totalProfiles },
        stageBreakdown,
        latestReferred,
        // Lightweight overview summaries so the dashboard page does not need
        // extra round-trips just for headline counts.
        totalReferred: totalReferredProfiles + earlyConsultation,
        needsRevision,
        deviceSummary: { issued: issuedDevices, returned: returnedDevices },
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

// Evidence-chain bookkeeping: AdmForm rows are the trackable face of case
// records (referral filed, anecdotal filed, minutes logged, home visit
// done, certification issued). They are materialized from the
// authoritative records at the moment the coordinator acts — verified,
// because the source record provably exists — so the Evidence chain,
// eligibility buckets, and principal signing all read the same truth.
// Idempotent per (profile, formType).
type AdmFormKind =
  | "REFERRAL_FORM"
  | "ANECDOTAL_REPORT"
  | "MINUTES_OF_MEETING"
  | "HV_FORM"
  | "CERTIFICATION";

// The `db` param lets callers run the check inside their own transaction
// (e.g. profile creation) — defaults to the global client otherwise.
type AdmFormClient = Pick<typeof prisma, "admForm">;

async function ensureAdmForm(
  profileId: string,
  formType: AdmFormKind,
  title: string,
  uploadedBy: string,
  db: AdmFormClient = prisma,
): Promise<void> {
  const existing = await db.admForm.findFirst({
    where: { admLearnerProfileId: profileId, formType },
    select: { id: true, status: true },
  });
  if (existing) {
    if (existing.status !== "verified") {
      await db.admForm.update({
        where: { id: existing.id },
        data: { status: "verified" },
      });
    }
    return;
  }
  await db.admForm.create({
    data: {
      admLearnerProfileId: profileId,
      formType,
      title,
      status: "verified",
      uploadedBy,
      notes: "Auto-recorded from the case evidence.",
    },
  });
}

const REFERRAL_STAGES: AdmStage[] = [
  "meeting_parents",
  "home_visitation",
  "certification",
  "principal_approval",
];

const ENROLLED_STAGES: AdmStage[] = [
  "enrollment_monitoring",
  "completion",
];

router.get(
  "/referrals/all",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm"] }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      // Allow wide reads (certification summaries) up to 200 rows; the
      // coordinator queues page with the default 20.
      const rawLimit = Number(req.query.limit);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(Math.floor(rawLimit), 200)
          : PAGE_SIZE;
      const skip = (page - 1) * limit;
      const q =
        typeof req.query.q === "string" && req.query.q.trim()
          ? req.query.q.trim().toLowerCase()
          : "";
      const stageParam =
        typeof req.query.stage === "string" && req.query.stage.trim()
          ? req.query.stage.trim()
          : "";
      const ACTIVE_STAGES: AdmStage[] = [...REFERRAL_STAGES, "consultation", ...ENROLLED_STAGES];
      const stageFilter: AdmStage | "" =
        stageParam && (ACTIVE_STAGES as string[]).includes(stageParam)
          ? (stageParam as AdmStage)
          : "";
      // Server-side eligibility filter (pending | eligible | ineligible).
      // Unknown/absent values behave as "all" so existing callers are
      // unaffected. Early referral rows are always pending, so a non-pending
      // filter excludes them (see includeEarly below).
      const eligibilityParam =
        typeof req.query.eligibility === "string" && req.query.eligibility.trim()
          ? req.query.eligibility.trim()
          : "";
      const eligibilityFilter: "pending" | "eligible" | "ineligible" | "" =
        eligibilityParam === "pending" ||
        eligibilityParam === "eligible" ||
        eligibilityParam === "ineligible"
          ? eligibilityParam
          : "";

      // Default (no stage) stays referral-only so the Referrals queue never
      // mixes in enrolled learners. Explicit enrollment_monitoring /
      // completion filters serve the coordinator Enrolled page (approved
      // cases from the Principal).
      const where: Prisma.AdmLearnerProfileWhereInput = {
        ...(stageFilter && stageFilter !== "consultation"
          ? { stage: stageFilter }
          : stageFilter === ""
            ? { stage: { in: REFERRAL_STAGES } }
            : { id: "__none__" }),
        ...(eligibilityFilter ? { eligibilityStatus: eligibilityFilter } : {}),
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

      // Filed ADM referrals the coordinator hasn't built a learner profile
      // for yet — visible here at the consultation stage instead of vanishing.
      // Roster enlistments without accounts count too. Early rows are always
      // eligibility-pending, so a non-pending eligibility filter skips them
      // (and their extra queries) entirely.
      const includeEarly =
        (!stageFilter || stageFilter === "consultation") &&
        (!eligibilityFilter || eligibilityFilter === "pending");
      const earlyWhere = {
        referredToRole: "adm_coordinator" as const,
        admProfiles: { none: {} },
        ...(q
          ? {
              OR: [
                { student: { user: { fullName: { contains: q, mode: "insensitive" as const } } } },
                { student: { lrn: { contains: q } } },
                { roster: { fullName: { contains: q, mode: "insensitive" as const } } },
                { roster: { lrn: { contains: q } } },
                { id: { contains: q } },
              ],
            }
          : {}),
      };

      const referredWhere: Prisma.AdmLearnerProfileWhereInput = { stage: { in: REFERRAL_STAGES } };
      // Enrolled/certification views never include early referral rows, so
      // they page in the database (skip/take + count) instead of pulling
      // every matching profile into memory. The referrals queue keeps its
      // merged in-memory paging to preserve early-row interleaving.
      const useDbPaging = !includeEarly;
      const [profileItems, stageGroups, totalReferredProfiles, earlyItems, totalProfiles] = await Promise.all([
        prisma.admLearnerProfile.findMany({
          where,
          include: {
            student: { include: { user: true } },
            preparedByUser: true,
            forms: { orderBy: { uploadedAt: "desc" }, take: 8 },
            parentMeetings: { orderBy: { meetingDatetime: "desc" }, take: 1 },
          },
          orderBy: { createdAt: "desc" },
          ...(useDbPaging ? { skip, take: limit } : {}),
        }),
        prisma.admLearnerProfile.groupBy({
          by: ["stage"],
          where: referredWhere,
          _count: { _all: true },
        }),
        prisma.admLearnerProfile.count({ where: referredWhere }),
        includeEarly
          ? prisma.referral.findMany({
              where: earlyWhere,
              include: {
                student: {
                  select: {
                    lrn: true,
                    gradeLevel: true,
                    user: { select: { fullName: true } },
                  },
                },
                roster: {
                  select: {
                    lrn: true,
                    fullName: true,
                    gradeLevel: true,
                  },
                },
                referredByUser: { select: { fullName: true } },
                anecdotalRecord: { select: { observationDatetime: true } },
              },
              orderBy: { id: "desc" },
            })
          : Promise.resolve([]),
        useDbPaging
          ? prisma.admLearnerProfile.count({ where })
          : Promise.resolve(0),
      ]);

      const countsByStage: Record<string, number> = {};
      for (const g of stageGroups) countsByStage[g.stage] = g._count?._all ?? 0;
      countsByStage.consultation = (countsByStage.consultation ?? 0) + earlyItems.length;
      const totalReferred = totalReferredProfiles + earlyItems.length;

      const profileRows = profileItems.map((p) => {
        const stage = p.stage;
        const latestMeeting = (p as unknown as { parentMeetings?: { id: string; meetingDatetime: Date; venue: string; attended: boolean }[] }).parentMeetings?.[0] ?? null;
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
          meeting: latestMeeting
            ? {
                id: latestMeeting.id,
                datetime: latestMeeting.meetingDatetime.toISOString(),
                venue: latestMeeting.venue,
                attended: latestMeeting.attended,
              }
            : null,
        };
        // Principal: status-only — strip confidential fields
        return req.user!.role === "principal" ? base : { ...base, studentId: p.studentId };
      });

      // Endorse moment per early referral = earliest audit entry for the
      // referral row (creation always writes one: "Referred to
      // adm_coordinator …"). This is the guidance/nurse hand-off time the
      // coordinator's waiting-time readouts run from — NOT the anecdotal
      // observation date. Legacy rows without an audit trail fall back to
      // the observation date so waiting never goes blank.
      const endorsedAtById = new Map<string, string>();
      if (earlyItems.length > 0) {
        const endorseLogs = await prisma.auditLog.findMany({
          where: {
            sourceTable: "referrals",
            sourceId: { in: earlyItems.map((r) => r.id) },
          },
          select: { sourceId: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        });
        for (const log of endorseLogs) {
          if (!endorsedAtById.has(log.sourceId)) {
            endorsedAtById.set(log.sourceId, log.createdAt.toISOString());
          }
        }
      }

      // Pre-profile referral bookings (no account needed) — latest per
      // referral so the Meeting column stays truthful for early rows.
      const meetingByReferralId = new Map<string, { id: string; datetime: string; venue: string; attended: boolean }>();
      if (earlyItems.length > 0) {
        const referralMeetings = await prisma.admParentMeeting.findMany({
          where: { referralId: { in: earlyItems.map((r) => r.id) } },
          orderBy: { meetingDatetime: "desc" },
        });
        for (const m of referralMeetings) {
          if (m.referralId && !meetingByReferralId.has(m.referralId)) {
            meetingByReferralId.set(m.referralId, {
              id: m.id,
              datetime: m.meetingDatetime.toISOString(),
              venue: m.venue,
              attended: m.attended,
            });
          }
        }
      }

      // Early referrals sit at consultation until the coordinator builds the
      // learner profile. Newest first, then paged in memory.
      const earlyRows = earlyItems.map((r) => {
        const base = {
          id: `referral:${r.id}`,
          lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
          student: r.student?.user.fullName ?? r.roster?.fullName ?? "",
          grade: GRADE_LABEL[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
          stage: "consultation" as const,
          eligibilityStatus: "pending" as const,
          preparedBy: r.referredByUser.fullName,
          datePrepared: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
          // Full-timestamp hand-off moment for elapsed-time readouts.
          endorsedAt: endorsedAtById.get(r.id) ?? null,
          approvedBy: null as string | null,
          approvalDate: null as string | null,
          // Consultation reviewer picked by the referring teacher
          // (nurse | guidance_counselor | lrpc | null when direct).
          consultReviewer: r.consultReviewer ?? null,
          referralStatus: r.status,
          forms: [] as { id: string; formType: string; title: string; status: string }[],
          meeting: meetingByReferralId.get(r.id) ?? null,
        };
        return req.user!.role === "principal" ? base : { ...base, studentId: "" };
      });

      // Newest hand-off first: early rows sort by endorse time, profiles by
      // creation date (they carry no endorse timestamp).
      const sortKey = (row: { datePrepared: string | null; endorsedAt?: string | null }) =>
        row.endorsedAt ? String(row.endorsedAt).slice(0, 10) : (row.datePrepared ?? "");
      const merged = [...profileRows, ...earlyRows].sort((a, b) =>
        sortKey(b).localeCompare(sortKey(a)),
      );
      // DB-paged views (enrolled, certification) already hold exactly one
      // page of profile rows and a counted total — skip the in-memory slice.
      const total = useDbPaging ? totalProfiles : merged.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const clampedPage = Math.min(page, totalPages);
      const slice = useDbPaging
        ? merged
        : merged.slice((clampedPage - 1) * limit, clampedPage * limit);

      res.json({
        rows: slice,
        total,
        totalReferred,
        stageCounts: countsByStage,
        page: clampedPage,
        totalPages,
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
      const rawLimit = Number(req.query.limit);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(Math.floor(rawLimit), 200)
          : PAGE_SIZE;
      const skip = (page - 1) * limit;
      const q =
        typeof req.query.q === "string" && req.query.q.trim()
          ? req.query.q.trim()
          : "";
      // DB-level search + paging so signed-certification reads stay
      // constant-time instead of pulling every signed profile into memory.
      const where: Prisma.AdmLearnerProfileWhereInput = {
        approvedBy: { not: null },
        ...(q
          ? {
              OR: [
                { student: { user: { fullName: { contains: q, mode: "insensitive" as const } } } },
                { student: { lrn: { contains: q } } },
                { id: { contains: q } },
                { approvedByUser: { fullName: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      };

      const [pageItems, total] = await Promise.all([
        prisma.admLearnerProfile.findMany({
          where,
          include: {
            student: { include: { user: true } },
            approvedByUser: true,
            preparedByUser: true,
            forms: { orderBy: { uploadedAt: "desc" } },
          },
          orderBy: { approvedAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.admLearnerProfile.count({ where }),
      ]);

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

// Teacher-scoped ADM cases (read-only): every ADM case for the teacher's
// advisory students, newest first. Status-only — stage labels, eligibility,
// principal-approval flag and evidence counts only; never certification
// details, recommendation text, meeting minutes, or home-visit notes.
router.get(
  "/my-cases",
  requireAuth,
  requireRole("adviser", "subject_teacher"),
  async (req, res, next) => {
    try {
      const teacherId = req.user!.id;
      const sections = await prisma.section.findMany({
        where: { adviserId: teacherId },
        select: { id: true },
      });
      if (sections.length === 0 && req.user!.role === "adviser") {
        throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
      }
      const sectionIds = sections.map((s) => s.id);
      const where: Prisma.AdmLearnerProfileWhereInput =
        sectionIds.length > 0
          ? { student: { sectionId: { in: sectionIds } } }
          : { referral: { referredBy: teacherId } };

      const profiles = await prisma.admLearnerProfile.findMany({
        where,
        select: {
          id: true,
          stage: true,
          eligibilityStatus: true,
          approvedBy: true,
          approvedAt: true,
          createdAt: true,
          referralId: true,
          student: {
            select: {
              userId: true,
              lrn: true,
              gradeLevel: true,
              photoUrl: true,
              user: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          referral: {
            select: {
              id: true,
              status: true,
              homeVisitations: { select: { id: true } },
            },
          },
          parentMeetings: { select: { attended: true } },
          modules: { select: { id: true, submitted: true } },
          devices: { select: { id: true, returnedDate: true } },
          forms: { select: { formType: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // ADM-track referrals that the coordinator hasn't built a learner
      // profile for yet — these are still the teacher's cases (sitting at the
      // consultation stage). Roster enlistments without accounts count too.
      const earlyWhere: Prisma.ReferralWhereInput =
        sectionIds.length > 0
          ? {
              referredToRole: "adm_coordinator",
              admProfiles: { none: {} },
              OR: [
                { student: { sectionId: { in: sectionIds } } },
                { roster: { sectionId: { in: sectionIds } } },
              ],
            }
          : {
              referredBy: teacherId,
              referredToRole: "adm_coordinator",
              admProfiles: { none: {} },
            };
      const earlyReferrals = await prisma.referral.findMany({
        where: earlyWhere,
        select: {
          id: true,
          status: true,
          student: {
            select: {
              userId: true,
              lrn: true,
              gradeLevel: true,
              photoUrl: true,
              user: { select: { fullName: true } },
              section: { select: { name: true } },
            },
          },
          roster: {
            select: {
              id: true,
              lrn: true,
              fullName: true,
              gradeLevel: true,
              section: { select: { name: true } },
            },
          },
          anecdotalRecord: { select: { observationDatetime: true } },
          homeVisitations: { select: { id: true } },
        },
        orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
      });

      const stageLabel = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));
      const earlyCases = earlyReferrals.map((r) => ({
        id: `referral:${r.id}`,
        studentId: r.student?.userId ?? `roster:${r.roster!.id}`,
        studentName: r.student?.user.fullName ?? r.roster?.fullName ?? "",
        lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
        gradeLevel: r.student?.gradeLevel ?? r.roster?.gradeLevel ?? "",
        section: r.student?.section?.name ?? r.roster?.section?.name ?? "",
        photoUrl: r.student?.photoUrl ?? null,
        referralId: r.id,
        referralStatus: r.status,
        stage: "consultation",
        stageLabel: stageLabel.get("consultation") ?? "Consultation & Referral",
        eligibilityStatus: "pending" as const,
        approved: false,
        approvedAt: null as string | null,
        datePrepared: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
        meetingAttended: null as boolean | null,
        hasHomeVisit: r.homeVisitations.length > 0,
        modulesSubmitted: 0,
        modulesTotal: 0,
        devicesIssued: 0,
        devicesReturned: 0,
        certificationIssued: false,
      }));

      res.json([
        ...profiles.map((p) => {
          const meetings = p.parentMeetings ?? [];
          return {
            id: p.id,
            studentId: p.student.userId,
            studentName: p.student.user.fullName,
            lrn: p.student.lrn,
            gradeLevel: p.student.gradeLevel,
            section: p.student.section?.name ?? "",
            photoUrl: p.student.photoUrl ?? null,
            referralId: p.referralId,
            referralStatus: p.referral.status,
            stage: p.stage,
            stageLabel: stageLabel.get(p.stage) ?? p.stage,
            eligibilityStatus: p.eligibilityStatus,
            approved: !!p.approvedBy,
            approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
            datePrepared: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : null,
            meetingAttended: meetings.length > 0 ? meetings.some((m) => m.attended) : null,
            hasHomeVisit: p.referral.homeVisitations.length > 0,
            modulesSubmitted: p.modules.filter((m) => m.submitted).length,
            modulesTotal: p.modules.length,
            devicesIssued: p.devices.length,
            devicesReturned: p.devices.filter((d) => d.returnedDate !== null).length,
            certificationIssued: p.forms.some(
              (f) => f.formType === "CERTIFICATION" && f.status === "verified"
            ),
          };
        }),
        ...earlyCases,
      ]);
    } catch (e) {
      next(e);
    }
  }
);

const profileSchema = z.object({
  studentId: z.string().min(1).optional(),
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
      const referral = await prisma.referral.findUnique({
        where: { id: req.body.referralId },
        include: {
          student: { select: { userId: true, user: { select: { fullName: true } } } },
          roster: {
            select: { lrn: true, fullName: true, gradeLevel: true, sectionId: true },
          },
        },
      });
      if (!referral) throw new AppError(404, "REFERRAL_NOT_FOUND", "Referral required for ADM profile");
      let studentId = req.body.studentId as string | undefined;
      let provisioned = false;
      if (studentId) {
        // An explicitly passed account must belong to this referral.
        if (referral.student?.userId !== studentId) {
          throw new AppError(400, "STUDENT_MISMATCH", "Student account does not match this referral");
        }
      } else if (referral.student?.userId) {
        studentId = referral.student.userId;
      } else if (referral.roster) {
        // Roster enlistment with no account yet: reuse an existing profile
        // for the LRN (provisioned before, or approved since), else
        // auto-provision a placeholder account + profile from the roster so
        // the ADM case is never blocked on signup.
        const roster = referral.roster;
        const existing = await prisma.studentProfile.findUnique({
          where: { lrn: roster.lrn },
          select: { userId: true },
        });
        if (existing) {
          studentId = existing.userId;
        } else {
          const email = `${roster.lrn}@adm-provisioned.local`;
          const stray = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
          });
          let userId: string;
          if (stray) {
            userId = stray.id;
          } else {
            // Unusable random secret — the placeholder can never log in.
            // When the learner later self-registers, approval adopts this
            // record instead of creating a duplicate (see auth approve).
            const passwordHash = await argon2.hash(crypto.randomBytes(32).toString("hex"));
            const user = await prisma.user.create({
              data: {
                email,
                passwordHash,
                role: "student",
                fullName: roster.fullName,
                lrn: roster.lrn,
              },
            });
            userId = user.id;
          }
          await prisma.studentProfile.create({
            data: {
              userId,
              lrn: roster.lrn,
              gradeLevel: roster.gradeLevel,
              sectionId: roster.sectionId,
            },
          });
          studentId = userId;
          provisioned = true;
        }
      } else {
        throw new AppError(400, "NO_STUDENT", "Referral has neither an account nor a roster enlistment");
      }
      // Atomic unit: profile + meeting transfer + evidence forms succeed
      // together or roll back together — a half-created case (profile with
      // no forms, or transferred meetings with no profile) must never
      // persist. No external I/O inside: provisioning + argon2 stay above.
      const me = req.user!.id;
      const profile = await prisma.$transaction(async (tx) => {
        const created = await tx.admLearnerProfile.create({
          data: {
            studentId: studentId as string,
            referralId: referral.id,
            termId: req.body.termId,
            ...(req.body.certificationDetails !== undefined
              ? { certificationDetails: req.body.certificationDetails }
              : {}),
            // A profile is always born from a referral, i.e. past
            // consultation — it starts at the parent-meeting stage (never the
            // schema-default anecdotal) so the case stays on the referrals
            // list and only its status evolves from here.
            stage: "meeting_parents",
            // Creating the profile IS the coordinator's eligibility call —
            // the case leaves "For Review" the moment it is accepted. (The
            // certification step re-derives this from the evidence chain, so
            // the principal gate always reads a computed value.)
            eligibilityStatus: "eligible",
            preparedBy: me,
          },
        });
        // Carry over any pre-profile referral bookings (scheduled with no
        // account) so the meeting history stays on the case file.
        await tx.admParentMeeting.updateMany({
          where: { referralId: referral.id },
          data: { admLearnerProfileId: created.id, referralId: null },
        });
        // Materialize the evidence chain from records that provably exist —
        // the referral itself, its anecdotal write-up, and any already
        // attended pre-profile meeting.
        await ensureAdmForm(created.id, "REFERRAL_FORM", "Referral form", me, tx);
        if (referral.anecdotalRecordId) {
          await ensureAdmForm(created.id, "ANECDOTAL_REPORT", "Anecdotal report", me, tx);
        }
        const attendedCount = await tx.admParentMeeting.count({
          where: { admLearnerProfileId: created.id, attended: true },
        });
        if (attendedCount > 0) {
          await ensureAdmForm(created.id, "MINUTES_OF_MEETING", "Minutes of meeting", me, tx);
        }
        return created;
      });
      await writeAudit({ userId: me, actionType: "adm_edit", sourceTable: "adm_learner_profiles", sourceId: profile.id, reason: provisioned ? "ADM learner profile created (student auto-provisioned from roster)" : "ADM learner profile created" });
      res.status(201).json(provisioned ? { ...profile, provisioned: true } : profile);
      // Cache purges are non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "overview", "principal"]);
      if (provisioned) {
        void invalidateTags(["registrar", "record-keeper"]);
      }
      // Realtime handoff (background, off the coordinator critical path):
      // the referring adviser learns the profile exists without refreshing.
      // Previously this notified the coordinator themselves — never useful.
      if (referral.referredBy !== me) {
        const studentName =
          referral.student?.user?.fullName ??
          referral.roster?.fullName ??
          "your student";
        void fanoutNotification({
          userId: referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `Learner profile created for ${studentName} — parent meeting can now be booked.`,
          sourceId: referral.id,
        });
      }
    } catch (e) { next(e); }
  }
);

router.post(
  "/:id/principal-approve",
  requireAuth,
  requireRole("principal"),
  async (req, res, next) => {
    try {
      const profile = await prisma.admLearnerProfile.findUnique({
        where: { id: String(req.params.id) },
        include: {
          student: { select: { user: { select: { fullName: true } } } },
          referral: { select: { id: true, referredBy: true } },
        },
      });
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
      res.json(updated);
      // Cache purge is non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "overview", "principal"]);
      // The referring adviser learns the case was signed without refreshing.
      if (profile.referral && profile.referral.referredBy !== req.user!.id) {
        const studentName = profile.student?.user?.fullName ?? "your student";
        void fanoutNotification({
          userId: profile.referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `ADM case for ${studentName} signed by the Principal.`,
          sourceId: profile.referral.id,
        });
      }
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
        include: {
          student: { select: { user: { select: { fullName: true } } } },
        },
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
      res.json(updated);
      // Cache purge is non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "overview", "principal"]);
      // Returned cases go back to the coordinator who prepared them — notify
      // them (previously this notified the principal themselves). Background,
      // off the critical path.
      if (profile.preparedBy !== req.user!.id) {
        const studentName = profile.student?.user?.fullName ?? "your student";
        void fanoutNotification({
          userId: profile.preparedBy,
          sourceTable: "referrals",
          action: "status",
          message: `ADM case for ${studentName} returned by the Principal for revision.`,
          sourceId: profile.referralId,
        });
      }
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
      // Single read: the eligibility recompute below needs forms +
      // meetings, so fetch them here instead of a second findUnique.
      const profile = await prisma.admLearnerProfile.findUnique({
        where: { id: String(req.params.id) },
        include: {
          student: { select: { user: { select: { fullName: true } } } },
          referral: { select: { id: true, referredBy: true } },
          forms: { select: { formType: true, status: true } },
          parentMeetings: { select: { attended: true } },
        },
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
        data.eligibilityStatus = evaluateAdmEligibility({
          stage: target,
          forms: profile.forms,
          parentMeetings: profile.parentMeetings,
        });
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
      res.json(updated);
      // Cache purge is non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "overview", "principal"]);
      // Realtime handoff (background, off the critical path): the referring
      // adviser learns the case moved without refreshing. Best-effort —
      // never delays the response.
      if (profile.referral && profile.referral.referredBy !== req.user!.id) {
        const studentName = profile.student?.user?.fullName ?? "your student";
        const stageWords = target.replace(/_/g, " ");
        void fanoutNotification({
          userId: profile.referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message:
            target === "principal_approval"
              ? `ADM case for ${studentName} endorsed to the Principal.`
              : `ADM case for ${studentName} moved to ${stageWords}.`,
          sourceId: profile.referral.id,
        });
      }
    } catch (e) {
      next(e);
    }
  }
);

const certificationSchema = z.object({
  recommendation: z.string().trim().min(10).max(5000),
});

// The ADM Coordinator's recommendation + certification, filled up right
// after the parent meeting is attended: records the recommendation and
// passes the case straight to the Principal for signature in one click.
// Accepts any pre-certification stage — early referral bookings often
// leave the stage column lagging behind the attended meeting — but always
// requires an attended parent meeting (no home-visitation path needed).
// Eligibility recomputes from the evidence chain exactly like the stage
// route, so the principal gate always reads a computed value.
router.post(
  "/:id/certification",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", certificationSchema),
  async (req, res, next) => {
    try {
      const profile = await prisma.admLearnerProfile.findUnique({
        where: { id: String(req.params.id) },
        include: {
          forms: { select: { formType: true, status: true } },
          parentMeetings: { select: { attended: true } },
          student: { select: { user: { select: { fullName: true } } } },
          referral: {
            select: {
              id: true,
              referredBy: true,
              anecdotalRecordId: true,
              homeVisitations: { select: { id: true }, take: 1 },
            },
          },
        },
      });
      if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
      if (
        ["principal_approval", "enrollment_monitoring", "completion"].includes(
          profile.stage,
        )
      ) {
        throw new AppError(409, "ALREADY_CERTIFIED", "Certification already recorded for this case");
      }
      if (
        !["anecdotal", "consultation", "meeting_parents", "home_visitation", "certification"].includes(
          profile.stage,
        )
      ) {
        throw new AppError(
          409,
          "NOT_AT_CERTIFICATION_STAGE",
          `Certification needs a pre-approval case (stage: ${profile.stage})`,
        );
      }
      if (!profile.parentMeetings.some((m) => m.attended)) {
        throw new AppError(409, "MEETING_REQUIRED", "Record parent meeting attendance first");
      }
      // Final evidence sync so the chain, the page, and eligibility agree:
      // every row below is provable from a source record on this case.
      const me = req.user!.id;
      await ensureAdmForm(profile.id, "REFERRAL_FORM", "Referral form", me);
      if (profile.referral?.anecdotalRecordId) {
        await ensureAdmForm(profile.id, "ANECDOTAL_REPORT", "Anecdotal report", me);
      }
      await ensureAdmForm(profile.id, "MINUTES_OF_MEETING", "Minutes of meeting", me);
      if ((profile.referral?.homeVisitations?.length ?? 0) > 0) {
        await ensureAdmForm(profile.id, "HV_FORM", "Home visitation form", me);
      }
      await ensureAdmForm(profile.id, "CERTIFICATION", "ADM certification", me);
      const forms = await prisma.admForm.findMany({
        where: { admLearnerProfileId: profile.id },
        select: { formType: true, status: true },
      });
      const eligibilityStatus = evaluateAdmEligibility({
        stage: "principal_approval",
        forms,
        parentMeetings: profile.parentMeetings,
      });
      const prev = profile.certificationDetails;
      const prevDetails =
        prev && typeof prev === "object" && !Array.isArray(prev)
          ? (prev as Record<string, unknown>)
          : {};
      const updated = await prisma.admLearnerProfile.update({
        where: { id: profile.id },
        data: {
          stage: "principal_approval",
          eligibilityStatus,
          certificationDetails: {
            ...prevDetails,
            recommendation: req.body.recommendation as string,
            certifiedBy: req.user!.id,
            certifiedAt: new Date().toISOString(),
          },
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "adm_edit",
        sourceTable: "adm_learner_profiles",
        sourceId: profile.id,
        reason: "ADM certification created and endorsed to Principal",
        oldValue: { stage: profile.stage },
        newValue: { stage: "principal_approval" },
      });
      res.json(updated);
      // Cache purge is non-critical — never delay the confirmed response.
      void invalidateTags(["adm", "overview", "principal"]);
      // Realtime handoff (background, off the critical path): the referring
      // adviser learns the case was certified without refreshing.
      if (profile.referral && profile.referral.referredBy !== req.user!.id) {
        const studentName = profile.student?.user?.fullName ?? "your student";
        void fanoutNotification({
          userId: profile.referral.referredBy,
          sourceTable: "referrals",
          action: "status",
          message: `ADM case for ${studentName} certified and endorsed to the Principal.`,
          sourceId: profile.referral.id,
        });
      }
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
      const serial = String(req.body.deviceSerial ?? "").trim();
      // Guard: one active issue per serial — a still-issued device holding
      // the same serial (case-insensitive) rejects with 409 so the dialog
      // can show an inline duplicate error instead of double-issuing.
      const clash = await prisma.admDevice.findFirst({
        where: {
          deviceSerial: { equals: serial, mode: "insensitive" },
          returnedDate: null,
        },
        select: { id: true },
      });
      if (clash) throw new AppError(409, "DEVICE_SERIAL_IN_USE", `Serial ${serial} is already issued and not yet returned`);
      const profile = await prisma.admLearnerProfile.findUnique({
        where: { id: String(req.body.admLearnerProfileId) },
        include: {
          student: { select: { user: { select: { fullName: true } } } },
          referral: { select: { id: true, referredBy: true } },
        },
      });
      if (!profile) throw new AppError(404, "NOT_FOUND", "ADM learner profile not found");
      const device = await prisma.admDevice.create({
        data: { ...req.body, deviceSerial: serial, issuedBy: req.user!.id, issuedDate: req.body.issuedDate ? new Date(req.body.issuedDate) : new Date() },
      });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_devices", sourceId: device.id, reason: "ADM device issued" });
      res.status(201).json(device);
      // Non-critical work stays off the response path.
      void invalidateTags(["adm", "overview", "principal"]);
      // Realtime handoff: the referring adviser learns the device moved
      // without refreshing. Best-effort — never delays the response.
      if (profile.referral && profile.referral.referredBy !== req.user!.id) {
        const studentName = profile.student?.user?.fullName ?? "your student";
        void fanoutNotification({
          userId: profile.referral.referredBy,
          sourceTable: "adm_devices",
          action: "issue",
          message: `Learning device ${serial} issued to ${studentName}.`,
          sourceId: device.id,
        });
      }
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
      const device = await prisma.admDevice.findUnique({
        where: { id: String(req.params.id) },
        include: {
          admLearnerProfile: {
            select: {
              referral: { select: { id: true, referredBy: true } },
              student: { select: { user: { select: { fullName: true } } } },
            },
          },
        },
      });
      if (!device) throw new AppError(404, "NOT_FOUND", "Device not found");
      if (device.returnedDate) throw new AppError(409, "ALREADY_RETURNED", "Device already returned");
      const updated = await prisma.admDevice.update({ where: { id: device.id }, data: { returnedDate: req.body.returnedDate ? new Date(req.body.returnedDate) : new Date() } });
      await writeAudit({ userId: req.user!.id, actionType: "adm_edit", sourceTable: "adm_devices", sourceId: device.id, reason: "ADM device returned" });
      res.json(updated);
      // Non-critical work stays off the response path.
      void invalidateTags(["adm", "overview", "principal"]);
      // Realtime handoff: the referring adviser learns of the return
      // without refreshing. Best-effort — never delays the response.
      const ref = device.admLearnerProfile?.referral;
      if (ref && ref.referredBy !== req.user!.id) {
        const studentName = device.admLearnerProfile?.student?.user?.fullName ?? "your student";
        void fanoutNotification({
          userId: ref.referredBy,
          sourceTable: "adm_devices",
          action: "return",
          message: `Learning device ${device.deviceSerial} marked returned for ${studentName}.`,
          sourceId: device.id,
        });
      }
    } catch (e) { next(e); }
  }
);

// Device ledger for the ADM Coordinator Devices page. Read-only join of
// every issued device with its learner profile + student. Status is derived
// (returnedDate != null → returned) — never stored.
router.get(
  "/devices",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm"] }),
  async (req, res, next) => {
    try {
      const q =
        typeof req.query.q === "string" && req.query.q.trim()
          ? req.query.q.trim()
          : "";
      const statusParam =
        typeof req.query.status === "string" && req.query.status.trim()
          ? req.query.status.trim()
          : "";
      // Overview summary only needs the N longest-out issued tablets.
      // `?status=issued&order=oldest&limit=5` serves that without shipping
      // the whole ledger. The Devices page sends `page + limit=20`.
      const limitParam = Number(req.query.limit);
      const limit =
        Number.isFinite(limitParam) && limitParam > 0
          ? Math.min(Math.floor(limitParam), 100)
          : 0;
      const page = Math.max(1, Number(req.query.page) || 1);
      const skip = limit > 0 ? (page - 1) * limit : 0;
      const orderOldest = req.query.order === "oldest";
      // DB-level status + search filter so the ledger stays constant-time
      // instead of pulling every device row into memory.
      const where: Prisma.AdmDeviceWhereInput = {
        ...(statusParam === "issued"
          ? { returnedDate: null }
          : statusParam === "returned"
            ? { returnedDate: { not: null } }
            : {}),
        ...(q
          ? {
              OR: [
                { deviceSerial: { contains: q, mode: "insensitive" as const } },
                {
                  admLearnerProfile: {
                    student: { user: { fullName: { contains: q, mode: "insensitive" as const } } },
                  },
                },
                { admLearnerProfile: { student: { lrn: { contains: q } } } },
              ],
            }
          : {}),
      };
      const deviceInclude = {
        admLearnerProfile: {
          select: {
            id: true,
            stage: true,
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
              },
            },
          },
        },
        issuer: { select: { fullName: true } },
      };
      const [devices, total, issued, returned] = await Promise.all([
        prisma.admDevice.findMany({
          where,
          include: deviceInclude,
          orderBy: { issuedDate: orderOldest ? "asc" : "desc" },
          ...(limit > 0 ? { skip, take: limit } : {}),
        }),
        prisma.admDevice.count({ where }),
        prisma.admDevice.count({ where: { returnedDate: null } }),
        prisma.admDevice.count({ where: { returnedDate: { not: null } } }),
      ]);
      const rows = devices.map((d) => ({
        id: d.id,
        admLearnerProfileId: d.admLearnerProfileId,
        student: d.admLearnerProfile.student.user.fullName,
        lrn: d.admLearnerProfile.student.lrn,
        grade: GRADE_LABEL[d.admLearnerProfile.student.gradeLevel] ?? d.admLearnerProfile.student.gradeLevel,
        stage: d.admLearnerProfile.stage,
        deviceType: d.deviceType,
        deviceSerial: d.deviceSerial,
        issuedBy: d.issuer.fullName,
        issuedDate: d.issuedDate.toISOString().slice(0, 10),
        returnedDate: d.returnedDate ? d.returnedDate.toISOString().slice(0, 10) : null,
        conditionNotes: d.conditionNotes,
        status: d.returnedDate ? ("returned" as const) : ("issued" as const),
      }));
      res.json({
        rows,
        total,
        issued,
        returned,
        ...(limit > 0
          ? { page, totalPages: Math.max(1, Math.ceil(total / limit)), limit }
          : {}),
      });
    } catch (e) { next(e); }
  }
);

// Parent/guardian meetings booked by the coordinator once a case is
// referred to ADM — in school ("school") or at home ("home", home
// visitation). Booking is allowed for any unsigned profile at a
// pre-certification stage; recording the outcome later drives the
// meeting_parents → certification | home_visitation branch.
const meetingBookSchema = z.object({
  meetingDatetime: z.string().datetime(),
  venue: z.enum(["school", "home"]).default("school"),
  minutesOfMeeting: z.string().optional(),
  attendanceLogbookRef: z.string().optional(),
});

const PRE_CERT_STAGES: AdmStage[] = ["anecdotal", "consultation", "meeting_parents"];

router.post(
  "/:id/meetings",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", meetingBookSchema),
  async (req, res, next) => {
    try {
      const profile = await prisma.admLearnerProfile.findUnique({
        where: { id: String(req.params.id) },
        include: {
          student: { select: { user: { select: { fullName: true } } } },
          referral: { select: { id: true, referredBy: true } },
        },
      });
      if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
      if (profile.approvedBy || !PRE_CERT_STAGES.includes(profile.stage)) {
        throw new AppError(409, "MEETING_LOCKED", "Meetings can only be booked before certification");
      }
      // One booked meeting per case: a still-unattended meeting blocks a
      // second booking — reschedule it instead (PATCH
      // /api/adm/meetings/:meetingId/reschedule).
      const pendingMeeting = await prisma.admParentMeeting.count({
        where: { admLearnerProfileId: profile.id, attended: false },
      });
      if (pendingMeeting > 0) {
        throw new AppError(
          409,
          "MEETING_ALREADY_BOOKED",
          "This case already has a booked meeting — reschedule it instead of booking another one"
        );
      }
      const meeting = await prisma.admParentMeeting.create({
        data: {
          admLearnerProfileId: profile.id,
          recordedBy: req.user!.id,
          meetingDatetime: new Date(req.body.meetingDatetime),
          venue: req.body.venue,
          attended: false,
          minutesOfMeeting: req.body.minutesOfMeeting,
          attendanceLogbookRef: req.body.attendanceLogbookRef,
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "adm_edit",
        sourceTable: "adm_parent_meetings",
        sourceId: meeting.id,
        reason: `Parent meeting booked (${req.body.venue === "home" ? "home visitation" : "in school"})`,
      });
      await invalidateTags(["adm", "overview", "principal"]);
      res.status(201).json(meeting);
      // Realtime handoff (background, off the coordinator critical path):
      // the referring adviser sees a sileo toast on their current page the
      // moment this booking lands. fanoutNotification is best-effort and
      // never throws, so the coordinator's 201 is never delayed by it.
      if (profile.referral && profile.referral.referredBy !== req.user!.id) {
        const adviserId = profile.referral.referredBy;
        const studentName = profile.student?.user?.fullName ?? "your student";
        const when = meeting.meetingDatetime.toISOString().slice(0, 16).replace("T", " ");
        const venueLabel = req.body.venue === "home" ? "home visitation" : "in school";
        void fanoutNotification({
          userId: adviserId,
          sourceTable: "adm_parent_meetings",
          action: "book",
          message: `Parent meeting booked for ${studentName} on ${when} (${venueLabel}).`,
          sourceId: meeting.id,
        });
      }
    } catch (e) { next(e); }
  }
);

// Pre-profile booking: schedule the parent meeting directly on a referral.
// Needs NO student account and NO learner profile — roster enlistments work.
// If a profile already exists for the referral, the meeting lands on it;
// otherwise it attaches to the referral and transfers on profile creation.
router.post(
  "/referral/:referralId/meetings",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", meetingBookSchema),
  async (req, res, next) => {
    try {
      const referral = await prisma.referral.findUnique({
        where: { id: String(req.params.referralId) },
        include: {
          student: { select: { user: { select: { fullName: true } } } },
          roster: { select: { fullName: true } },
          admProfiles: { select: { id: true, approvedBy: true, stage: true } },
        },
      });
      if (!referral) throw new AppError(404, "NOT_FOUND", "Referral not found");
      if (referral.referredToRole !== "adm_coordinator") {
        throw new AppError(409, "NOT_ADM_CASE", "This referral is not routed to ADM");
      }
      const profile = referral.admProfiles[0] ?? null;
      if (profile && (profile.approvedBy || !PRE_CERT_STAGES.includes(profile.stage as (typeof PRE_CERT_STAGES)[number]))) {
        throw new AppError(409, "MEETING_LOCKED", "Meetings can only be booked before certification");
      }
      // One booked meeting per case — a still-unattended meeting blocks a
      // second booking. Reschedule it instead (PATCH
      // /api/adm/meetings/:meetingId/reschedule).
      const pendingMeeting = await prisma.admParentMeeting.count({
        where: profile
          ? { admLearnerProfileId: profile.id, attended: false }
          : { referralId: referral.id, attended: false },
      });
      if (pendingMeeting > 0) {
        throw new AppError(
          409,
          "MEETING_ALREADY_BOOKED",
          "This case already has a booked meeting — reschedule it instead of booking another one"
        );
      }
      const meeting = await prisma.admParentMeeting.create({
        data: {
          admLearnerProfileId: profile ? profile.id : null,
          referralId: profile ? null : referral.id,
          recordedBy: req.user!.id,
          meetingDatetime: new Date(req.body.meetingDatetime),
          venue: req.body.venue,
          attended: false,
          minutesOfMeeting: req.body.minutesOfMeeting,
          attendanceLogbookRef: req.body.attendanceLogbookRef,
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "adm_edit",
        sourceTable: "adm_parent_meetings",
        sourceId: meeting.id,
        reason: `Parent meeting booked (${req.body.venue === "home" ? "home visitation" : "in school"})`,
      });
      await invalidateTags(["adm", "overview", "principal"]);
      res.status(201).json(meeting);
      // Realtime handoff (background, off the coordinator critical path):
      // the referring adviser sees a sileo toast on their current page the
      // moment this booking lands. Best-effort — never delays the 201.
      if (referral.referredBy !== req.user!.id) {
        const adviserId = referral.referredBy;
        const studentName =
          referral.student?.user?.fullName ?? referral.roster?.fullName ?? "your student";
        const when = meeting.meetingDatetime.toISOString().slice(0, 16).replace("T", " ");
        const venueLabel = req.body.venue === "home" ? "home visitation" : "in school";
        void fanoutNotification({
          userId: adviserId,
          sourceTable: "adm_parent_meetings",
          action: "book",
          message: `Parent meeting booked for ${studentName} on ${when} (${venueLabel}).`,
          sourceId: meeting.id,
        });
      }
    } catch (e) { next(e); }
  }
);

// Reschedule a still-booked (unattended) parent meeting — new date/time
// and/or venue. Attended meetings keep their history and cannot move; book
// a fresh meeting instead. Locked (certified/signed) cases reject too.
const meetingRescheduleSchema = z.object({
  meetingDatetime: z.string().datetime(),
  venue: z.enum(["school", "home"]).default("school"),
  attendanceLogbookRef: z.string().trim().max(200).optional(),
});

router.patch(
  "/meetings/:meetingId/reschedule",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", meetingRescheduleSchema),
  async (req, res, next) => {
    try {
      const meeting = await prisma.admParentMeeting.findUnique({
        where: { id: String(req.params.meetingId) },
        include: {
          admLearnerProfile: {
            select: {
              id: true,
              approvedBy: true,
              stage: true,
              student: { select: { user: { select: { fullName: true } } } },
              referral: {
                select: {
                  referredBy: true,
                  student: { select: { user: { select: { fullName: true } } } },
                  roster: { select: { fullName: true } },
                },
              },
            },
          },
          referral: {
            select: {
              id: true,
              referredToRole: true,
              referredBy: true,
              student: { select: { user: { select: { fullName: true } } } },
              roster: { select: { fullName: true } },
            },
          },
        },
      });
      if (!meeting) throw new AppError(404, "NOT_FOUND", "Meeting not found");
      if (meeting.attended) {
        throw new AppError(
          409,
          "MEETING_ATTENDED",
          "This meeting was already attended — book a new meeting instead of rescheduling it"
        );
      }
      if (
        meeting.admLearnerProfile &&
        (meeting.admLearnerProfile.approvedBy ||
          !PRE_CERT_STAGES.includes(meeting.admLearnerProfile.stage as (typeof PRE_CERT_STAGES)[number]))
      ) {
        throw new AppError(409, "MEETING_LOCKED", "Meetings can only be rescheduled before certification");
      }
      if (meeting.referral && meeting.referral.referredToRole !== "adm_coordinator") {
        throw new AppError(409, "NOT_ADM_CASE", "This referral is not routed to ADM");
      }
      const nextAt = new Date(req.body.meetingDatetime);
      if (Number.isNaN(nextAt.getTime()) || nextAt.getTime() <= Date.now()) {
        throw new AppError(400, "INVALID_DATE", "Pick a future date and time for the meeting");
      }
      const updated = await prisma.admParentMeeting.update({
        where: { id: meeting.id },
        data: {
          meetingDatetime: nextAt,
          venue: req.body.venue,
          ...(typeof req.body.attendanceLogbookRef === "string" && req.body.attendanceLogbookRef.trim()
            ? { attendanceLogbookRef: req.body.attendanceLogbookRef.trim() }
            : {}),
        },
      });
      await writeAudit({
        userId: req.user!.id,
        actionType: "adm_edit",
        sourceTable: "adm_parent_meetings",
        sourceId: meeting.id,
        reason: `Parent meeting rescheduled to ${nextAt.toISOString().slice(0, 16).replace("T", " ")} (${req.body.venue === "home" ? "home visitation" : "in school"})`,
        oldValue: { meetingDatetime: meeting.meetingDatetime, venue: meeting.venue },
        newValue: { meetingDatetime: nextAt, venue: req.body.venue },
      });
      await invalidateTags(["adm", "overview", "principal"]);
      res.json(updated);
      // The referring adviser learns the new schedule without refreshing.
      // (Book + outcome already fan out; reschedule previously stayed silent.)
      const actorId = req.user!.id;
      const adviserId =
        meeting.referral?.referredBy ??
        meeting.admLearnerProfile?.referral?.referredBy ??
        null;
      if (adviserId && adviserId !== actorId) {
        const studentName =
          meeting.referral?.student?.user?.fullName ??
          meeting.referral?.roster?.fullName ??
          meeting.admLearnerProfile?.student?.user?.fullName ??
          meeting.admLearnerProfile?.referral?.student?.user?.fullName ??
          meeting.admLearnerProfile?.referral?.roster?.fullName ??
          "your student";
        const when = nextAt.toISOString().slice(0, 16).replace("T", " ");
        void fanoutNotification({
          userId: adviserId,
          sourceTable: "adm_parent_meetings",
          action: "reschedule",
          message: `Parent meeting for ${studentName} moved to ${when}.`,
          sourceId: meeting.id,
        });
      }
    } catch (e) { next(e); }
  }
);

// Dedicated case file for the coordinator's "Open case" new-tab page.
// Accepts either a learner-profile id or a `referral:<id>` row id (early
// referrals without a profile yet). Returns the student header, the
// adviser's anecdotal write-up + recommendations, the GCForm-03 referral
// form state, the ADM evidence chain (forms), and parent meetings —
// everything the new-tab page renders without extra round-trips.
router.get(
  "/case/:id",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm"] }),
  async (req, res, next) => {
    try {
      const raw = String(req.params.id);
      const referralPrefix = "referral:";
      const asReferralId = raw.startsWith(referralPrefix)
        ? raw.slice(referralPrefix.length)
        : null;

      let profile: {
        id: string;
        stage: string;
        eligibilityStatus: string;
        referralId: string;
        createdAt: Date;
        approvedAt: Date | null;
        certificationDetails: unknown;
        student: {
          lrn: string;
          gradeLevel: string;
          user: { fullName: string };
        };
        preparedByUser: { fullName: string };
        approvedByUser: { fullName: string } | null;
        forms: {
          id: string;
          formType: string;
          title: string;
          status: string;
          notes: string | null;
          uploadedAt: Date | null;
        }[];
      } | null = null;
      let referralId: string | null = asReferralId;

      if (!referralId) {
        profile = await prisma.admLearnerProfile.findUnique({
          where: { id: raw },
          include: {
            student: { include: { user: { select: { fullName: true } } } },
            preparedByUser: { select: { fullName: true } },
            approvedByUser: { select: { fullName: true } },
            forms: { orderBy: { uploadedAt: "desc" } },
          },
        });
        if (profile) {
          referralId = profile.referralId;
        } else {
          // Fall back to a bare referral id (no `referral:` prefix).
          const direct = await prisma.referral.findUnique({
            where: { id: raw },
            select: { id: true },
          });
          if (!direct) throw new AppError(404, "NOT_FOUND", "ADM case not found");
          referralId = direct.id;
        }
      }

      const referral = referralId
        ? await prisma.referral.findUnique({
            where: { id: referralId },
            include: {
              anecdotalRecord: {
                include: {
                  observer: { select: { fullName: true } },
                  section: { select: { name: true } },
                },
              },
              referredByUser: { select: { fullName: true } },
              student: {
                select: {
                  lrn: true,
                  gradeLevel: true,
                  user: { select: { fullName: true } },
                },
              },
              roster: {
                select: { lrn: true, fullName: true, gradeLevel: true },
              },
              counselingSessions: {
                orderBy: { scheduledAt: "asc" },
                select: {
                  id: true,
                  sessionType: true,
                  scheduledAt: true,
                  venue: true,
                  status: true,
                  sessionNotes: true,
                  outcome: true,
                },
              },
            },
          })
        : null;
      if (referralId && !referral) {
        throw new AppError(404, "NOT_FOUND", "ADM case not found");
      }

      // Profile may not exist yet for early referral rows — resolve it by
      // referral when the caller passed `referral:<id>`.
      if (!profile && referralId) {
        const linked = await prisma.admLearnerProfile.findFirst({
          where: { referralId },
          include: {
            student: { include: { user: { select: { fullName: true } } } },
            preparedByUser: { select: { fullName: true } },
            approvedByUser: { select: { fullName: true } },
            forms: { orderBy: { uploadedAt: "desc" } },
          },
        });
        if (linked) profile = linked;
      }

      const meetings = profile
        ? await prisma.admParentMeeting.findMany({
            where: { admLearnerProfileId: profile.id },
            include: { recorder: { select: { fullName: true } } },
            orderBy: { meetingDatetime: "asc" },
          })
        : referralId
          ? await prisma.admParentMeeting.findMany({
              where: { referralId },
              include: { recorder: { select: { fullName: true } } },
              orderBy: { meetingDatetime: "asc" },
            })
          : [];

      const anecdotal = referral?.anecdotalRecord ?? null;
      const studentName =
        profile?.student.user.fullName ??
        referral?.student?.user.fullName ??
        referral?.roster?.fullName ??
        "";
      const lrn =
        profile?.student.lrn ?? referral?.student?.lrn ?? referral?.roster?.lrn ?? "";
      const gradeRaw =
        profile?.student.gradeLevel ??
        referral?.student?.gradeLevel ??
        referral?.roster?.gradeLevel ??
        "";
      const rowId = profile ? profile.id : `referral:${referralId}`;

      res.json({
        id: rowId,
        kind: profile ? ("profile" as const) : ("referral" as const),
        profileId: profile?.id ?? null,
        referralId,
        student: studentName,
        lrn,
        grade: GRADE_LABEL[gradeRaw] ?? gradeRaw,
        stage: profile?.stage ?? "consultation",
        eligibilityStatus: profile?.eligibilityStatus ?? "pending",
        preparedBy:
          profile?.preparedByUser.fullName ?? referral?.referredByUser.fullName ?? "",
        datePrepared: profile
          ? profile.createdAt.toISOString().slice(0, 10)
          : (anecdotal ? anecdotal.observationDatetime.toISOString().slice(0, 10) : null),
        approvedBy: profile?.approvedByUser?.fullName ?? null,
        approvalDate: profile?.approvedAt
          ? profile.approvedAt.toISOString().slice(0, 10)
          : null,
        certificationDetails: profile?.certificationDetails ?? null,
        referral: referral
          ? {
              id: referral.id,
              reason: referral.reason,
              status: referral.status,
              consultReviewer: referral.consultReviewer,
              referralFormReady: referral.referralFormReady,
              notes: referral.notes,
              priority: referral.priority,
              intakeNotes: referral.intakeNotes,
              resolutionSummary: referral.resolutionSummary,
              referredBy: referral.referredByUser.fullName,
            }
          : null,
        anecdotal: anecdotal
          ? {
              id: anecdotal.id,
              observationDatetime: anecdotal.observationDatetime.toISOString(),
              observationDate: anecdotal.observationDatetime.toISOString().slice(0, 10),
              category: anecdotal.category,
              confidentialityLevel: anecdotal.confidentialityLevel,
              descriptionOfIncident: anecdotal.descriptionOfIncident,
              descriptionOfLocation: anecdotal.descriptionOfLocation,
              // Adviser recommendations / actions — the "recommendations"
              // block on the dedicated page.
              recommendations: anecdotal.notesRecommendationsActions,
              classPerformance: anecdotal.classPerformance,
              attendanceSummary: anecdotal.attendanceSummary,
              observer: anecdotal.observer.fullName,
              section: anecdotal.section.name,
            }
          : null,
        // GCForm-03 (referral form) state — completed on the nurse
        // referral-form page; the coordinator page surfaces readiness plus
        // the stored endorsement/recommendation note.
        gcForm03: referral
          ? { ready: referral.referralFormReady }
          : null,
        forms: (profile?.forms ?? []).map((f) => ({
          id: f.id,
          formType: f.formType,
          title: f.title,
          status: f.status,
          notes: f.notes,
          uploadedAt: f.uploadedAt ? f.uploadedAt.toISOString() : null,
        })),
        meetings: meetings.map((m) => ({
          id: m.id,
          meetingDatetime: m.meetingDatetime.toISOString(),
          venue: m.venue,
          attended: m.attended,
          parentConfirmedAt: m.parentConfirmedAt ? m.parentConfirmedAt.toISOString() : null,
          minutesOfMeeting: m.minutesOfMeeting,
          attendanceLogbookRef: m.attendanceLogbookRef,
          attendees: m.attendees ?? [],
          recordedBy: m.recorder.fullName,
        })),
        sessions: (referral?.counselingSessions ?? []).map((s) => ({
          id: s.id,
          sessionType: s.sessionType,
          scheduledAt: s.scheduledAt.toISOString(),
          venue: s.venue,
          status: s.status,
          sessionNotes: s.sessionNotes,
          outcome: s.outcome,
        })),
      });
    } catch (e) { next(e); }
  }
);

router.get(
  "/:id/meetings",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  async (req, res, next) => {
    try {
      const profile = await prisma.admLearnerProfile.findUnique({
        where: { id: String(req.params.id) },
        select: { id: true },
      });
      if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
      const meetings = await prisma.admParentMeeting.findMany({
        where: { admLearnerProfileId: profile.id },
        include: { recorder: { select: { fullName: true } } },
        orderBy: { meetingDatetime: "asc" },
      });
      res.json({
        meetings: meetings.map((m) => ({
          id: m.id,
          meetingDatetime: m.meetingDatetime.toISOString(),
          venue: m.venue,
          attended: m.attended,
          parentConfirmedAt: m.parentConfirmedAt ? m.parentConfirmedAt.toISOString() : null,
          minutesOfMeeting: m.minutesOfMeeting,
          attendanceLogbookRef: m.attendanceLogbookRef,
          attendees: m.attendees ?? [],
          recordedBy: m.recorder.fullName,
        })),
      });
    } catch (e) { next(e); }
  }
);

const meetingOutcomeSchema = z.object({
  attended: z.boolean(),
  minutesOfMeeting: z.string().optional(),
  attendanceLogbookRef: z.string().optional(),
  parentConfirmedAt: z.string().datetime().optional(),
  // People present, logged by the ADM Coordinator with the outcome:
  // at most 20 { name, role } entries.
  attendees: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        role: z.enum([
          "parent_guardian",
          "teacher",
          "student",
          "guidance_counselor",
          "nurse",
          "principal",
          "lrpc",
          "other",
        ]),
      }),
    )
    .max(20)
    .optional(),
});

router.patch(
  "/meetings/:meetingId",
  requireAuth,
  requireRole("adm_coordinator"),
  validate("body", meetingOutcomeSchema),
  async (req, res, next) => {
    try {
      const meeting = await prisma.admParentMeeting.findUnique({
        where: { id: String(req.params.meetingId) },
        include: {
          admLearnerProfile: {
            select: {
              id: true,
              approvedBy: true,
              student: { select: { user: { select: { fullName: true } } } },
              referral: {
                select: {
                  referredBy: true,
                  student: { select: { user: { select: { fullName: true } } } },
                  roster: { select: { fullName: true } },
                },
              },
            },
          },
          referral: {
            select: {
              referredBy: true,
              student: { select: { user: { select: { fullName: true } } } },
              roster: { select: { fullName: true } },
            },
          },
        },
      });
      if (!meeting) throw new AppError(404, "NOT_FOUND", "Meeting not found");
      if (meeting.admLearnerProfile?.approvedBy) {
        throw new AppError(409, "MEETING_LOCKED", "Meetings can only be updated before certification");
      }
      const attended = req.body.attended as boolean;
      const updated = await prisma.admParentMeeting.update({
        where: { id: meeting.id },
        data: {
          attended,
          minutesOfMeeting: req.body.minutesOfMeeting,
          attendanceLogbookRef: req.body.attendanceLogbookRef,
          parentConfirmedAt: req.body.parentConfirmedAt ? new Date(req.body.parentConfirmedAt) : undefined,
          ...(req.body.attendees !== undefined ? { attendees: req.body.attendees } : {}),
        },
      });
      // An attended meeting materializes its minutes row (referral bookings
      // without a profile yet sync up when the profile is created).
      if (attended && meeting.admLearnerProfileId) {
        await ensureAdmForm(
          meeting.admLearnerProfileId,
          "MINUTES_OF_MEETING",
          "Minutes of meeting",
          req.user!.id,
        );
      }
      await writeAudit({
        userId: req.user!.id,
        actionType: "adm_edit",
        sourceTable: "adm_parent_meetings",
        sourceId: meeting.id,
        reason: attended ? "Parent meeting attended" : "Parents did not attend — home visitation path",
        oldValue: { attended: meeting.attended },
        newValue: { attended },
      });
      await invalidateTags(["adm", "overview", "principal"]);
      res.json(updated);
      // Realtime handoff (background, off the coordinator critical path):
      // the referring adviser learns the meeting outcome without refreshing.
      // Best-effort — never delays the response.
      const actorId = req.user!.id;
      const adviserId =
        meeting.referral?.referredBy ??
        meeting.admLearnerProfile?.referral?.referredBy ??
        null;
      if (adviserId && adviserId !== actorId) {
        const studentName =
          meeting.referral?.student?.user?.fullName ??
          meeting.referral?.roster?.fullName ??
          meeting.admLearnerProfile?.student?.user?.fullName ??
          meeting.admLearnerProfile?.referral?.student?.user?.fullName ??
          meeting.admLearnerProfile?.referral?.roster?.fullName ??
          "your student";
        void fanoutNotification({
          userId: adviserId,
          sourceTable: "adm_parent_meetings",
          action: "outcome",
          message: attended
            ? `Parents attended the meeting for ${studentName}.`
            : `Parents did not attend the meeting for ${studentName} — home visitation path applies.`,
          sourceId: meeting.id,
        });
      }
    } catch (e) { next(e); }
  }
);
// Case history timeline for the coordinator's "See history" action. Returns
// the audit trail across the anecdotal filing, the source referral, the
// learner profile, and its devices — system events only (reasons + stage
// diffs), never clinical write-ups. Oldest first: adviser filing →
// guidance/nurse endorse → coordinator actions → principal decision →
// devices. At least one of profileId / referralId is required.
router.get(
  "/history",
  requireAuth,
  requireRole("adm_coordinator", "principal"),
  cache({ tags: ["adm"] }),
  async (req, res, next) => {
    try {
      const profileId =
        typeof req.query.profileId === "string" && req.query.profileId.trim()
          ? req.query.profileId.trim()
          : null;
      const referralParam =
        typeof req.query.referralId === "string" && req.query.referralId.trim()
          ? req.query.referralId.trim()
          : null;
      if (!profileId && !referralParam) {
        throw new AppError(400, "ID_REQUIRED", "profileId or referralId is required");
      }
      let referralId = referralParam;
      let deviceIds: string[] = [];
      if (profileId) {
        const profile = await prisma.admLearnerProfile.findUnique({
          where: { id: profileId },
          select: { referralId: true, devices: { select: { id: true } } },
        });
        if (!profile) throw new AppError(404, "NOT_FOUND", "ADM profile not found");
        referralId = profile.referralId;
        deviceIds = profile.devices.map((d) => d.id);
      }
      const ors: { sourceTable: string; sourceId: string }[] = [];
      if (referralId) {
        // Include the adviser's anecdotal filing that started the case.
        const referral = await prisma.referral.findUnique({
          where: { id: referralId },
          select: { anecdotalRecordId: true },
        });
        if (referral) {
          ors.push({ sourceTable: "anecdotal_records", sourceId: referral.anecdotalRecordId });
        }
        ors.push({ sourceTable: "referrals", sourceId: referralId });
      }
      if (profileId) ors.push({ sourceTable: "adm_learner_profiles", sourceId: profileId });
      for (const deviceId of deviceIds) ors.push({ sourceTable: "adm_devices", sourceId: deviceId });
      const logs = await prisma.auditLog.findMany({
        where: { OR: ors },
        include: { user: { select: { fullName: true, role: true } } },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
      res.json({
        events: logs.map((l) => ({
          id: l.id,
          actionType: String(l.actionType),
          sourceTable: l.sourceTable,
          reason: l.reason,
          oldValue: l.oldValue,
          newValue: l.newValue,
          actor: l.user.fullName,
          actorRole: String(l.user.role),
          at: l.createdAt.toISOString(),
        })),
      });
    } catch (e) { next(e); }
  }
);

export default router;
