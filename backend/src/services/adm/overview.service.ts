import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import {
  ADM_STAGE_FLOW,
  type AdmStage,
} from "../adm.js";
import { buildCaseTimeline } from "../../modules/referrals/timeline.js";
import { GRADE_LABEL } from "../../modules/adm/adm.repository.js";
import type { AdmContext } from "./adm.types.js";

// Coordinator/principal desk overview: aggregated counts + top-5 activity.
// Pure read — no audit, no notifications, no cache writes.
export async function getDashboard() {
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
    // Same endorsement gate as the queue: pending reviewer-owned cases
    // count on the reviewer's desk, never here.
    prisma.referral.count({
      where: {
        referredToRole: "adm_coordinator",
        admProfiles: { none: {} },
        NOT: {
          status: "pending",
          consultReviewer: { in: ["nurse", "guidance_counselor"] },
        },
      },
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
        student: {
          select: {
            lrn: true,
            gradeLevel: true,
            user: { select: { fullName: true } },
          },
        },
        preparedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" }, take: 8 },
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
      fileUrl: f.fileUrl ?? null,
      notes: f.notes ?? null,
      uploadedAt: f.uploadedAt ? f.uploadedAt.toISOString() : null,
    })),
  }));

  return {
    kpis: { pendingSignature, signed, active: totalProfiles },
    stageBreakdown,
    latestReferred,
    // Lightweight overview summaries so the dashboard page does not need
    // extra round-trips just for headline counts.
    totalReferred: totalReferredProfiles + earlyConsultation,
    needsRevision,
    deviceSummary: { issued: issuedDevices, returned: returnedDevices },
  };
}

export interface MyCasesQuery {
  q: string;
  page: number;
  pageSize: number;
  highlight: string;
  hasPaginationParams: boolean;
}

// Teacher-scoped ADM cases (read-only): only ADM cases from referrals the
// teacher filed themselves, newest first. Status-only — stage labels,
// eligibility, principal-approval flag and evidence counts only; never
// certification details, recommendation text, meeting minutes, or home-visit
// notes.
export async function getMyCases(ctx: AdmContext, query: MyCasesQuery) {
  const { q, page, pageSize, highlight, hasPaginationParams } = query;
  const teacherId = ctx.userId;
  const sections = await prisma.section.findMany({
    where: { adviserId: teacherId },
    select: { id: true },
  });
  if (sections.length === 0 && ctx.role === "adviser") {
    throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
  }
  const sectionIds = sections.map((s) => s.id);
  // Referred-only: a profile counts only when its referral was filed by
  // this teacher — cases other desks opened for the same advisees stay
  // out of this list.
  // Term-scoped (same contract as referrals/mine): only transactions
  // executed under the selected term. Re-linking the code in a new term
  // grants access; it never copies prior terms' cases over.
  const scopeTermId = ctx.termId;
  const termFilter = scopeTermId ? { termId: scopeTermId } : {};
  // Pending/ongoing only: cancelled (dismissed) cases never surface here —
  // they live on the teacher's referrals table (with Refer again).
  // Resolved (successfully closed) cases stay as history.
  const liveReferral: Prisma.ReferralWhereInput = {
    referredBy: teacherId,
    status: { not: "dismissed" },
  };
  const where: Prisma.AdmLearnerProfileWhereInput =
    sectionIds.length > 0
      ? { student: { sectionId: { in: sectionIds } }, referral: liveReferral, ...termFilter }
      : { referral: liveReferral, ...termFilter };

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
          consultReviewer: true,
          homeVisitations: { select: { id: true } },
        },
      },
      parentMeetings: { select: { attended: true, meetingDatetime: true } },
      modules: { select: { id: true, submitted: true, submissionDate: true } },
      devices: { select: { id: true, returnedDate: true } },
      forms: { select: { formType: true, status: true, uploadedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ADM-track referrals that the coordinator hasn't built a learner
  // profile for yet — only ones this teacher filed (sitting at the
  // consultation stage). Roster enlistments without accounts count too.
  const earlyWhere: Prisma.ReferralWhereInput =
    sectionIds.length > 0
      ? {
          referredToRole: "adm_coordinator",
          referredBy: teacherId,
          status: { not: "dismissed" },
          admProfiles: { none: {} },
          ...termFilter,
          OR: [
            { student: { sectionId: { in: sectionIds } } },
            { roster: { sectionId: { in: sectionIds } } },
          ],
        }
      : {
          referredBy: teacherId,
          referredToRole: "adm_coordinator",
          status: { not: "dismissed" },
          admProfiles: { none: {} },
          ...termFilter,
        };
  const earlyReferrals = await prisma.referral.findMany({
    where: earlyWhere,
    select: {
      id: true,
      status: true,
      consultReviewer: true,
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
  // Shared audit timeline per referral (same builder as referrals/mine)
  // so the adm-cases tracker tells the same story as the referrals one.
  const referralIds = [
    ...profiles.map((p) => p.referralId),
    ...earlyReferrals.map((r) => r.id),
  ];
  const timelines = await buildCaseTimeline(referralIds);
  // Approver roles for the principal-signature entries (one query).
  const approverIds = [
    ...new Set(
      profiles
        .map((p) => p.approvedBy ?? null)
        .filter((v): v is string => !!v)
    ),
  ];
  const approverRoles = new Map<string, string>();
  if (approverIds.length > 0) {
    const approvers = await prisma.user.findMany({
      where: { id: { in: approverIds } },
      select: { id: true, role: true },
    });
    for (const a of approvers) approverRoles.set(a.id, String(a.role));
  }
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
    consultReviewer: r.consultReviewer ?? null,
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
    certificationAt: null as string | null,
    lastMeetingAt: null as string | null,
    lastModuleAt: null as string | null,
    timeline: timelines.get(r.id) ?? [],
  }));

  const merged = [
    ...profiles.map((p) => {
      const meetings = p.parentMeetings ?? [];
      const timeline = timelines.get(p.referralId) ?? [];
      timeline.push({
        label: `Moved to the ${stageLabel.get(p.stage) ?? p.stage} stage.`,
        detail: null,
        date: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : "",
        at: p.createdAt ? p.createdAt.toISOString() : "",
        action: "adm_stage",
        byRole: "adm_coordinator",
        source: "case",
        stage: p.stage,
      });
      if (p.approvedBy && p.approvedAt) {
        timeline.push({
          label: "The principal signed the approval.",
          detail: null,
          date: p.approvedAt.toISOString().slice(0, 10),
          at: p.approvedAt.toISOString(),
          action: "adm_approved",
          byRole: approverRoles.get(p.approvedBy) ?? "principal",
          source: "case",
        });
      }
      timeline.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      const submittedModules = p.modules.filter((m) => m.submitted);
      const cert = p.forms.find(
        (f) => f.formType === "CERTIFICATION" && f.status === "verified" && f.uploadedAt
      );
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
        consultReviewer: p.referral.consultReviewer ?? null,
        stage: p.stage,
        stageLabel: stageLabel.get(p.stage) ?? p.stage,
        eligibilityStatus: p.eligibilityStatus,
        approved: !!p.approvedBy,
        approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
        datePrepared: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : null,
        meetingAttended: meetings.length > 0 ? meetings.some((m) => m.attended) : null,
        hasHomeVisit: p.referral.homeVisitations.length > 0,
        modulesSubmitted: submittedModules.length,
        modulesTotal: p.modules.length,
        lastModuleAt:
          submittedModules.length > 0 && submittedModules[0].submissionDate
            ? submittedModules
                .map((m) => (m.submissionDate as Date).toISOString())
                .sort()
                .slice(-1)[0]
            : null,
        devicesIssued: p.devices.length,
        devicesReturned: p.devices.filter((d) => d.returnedDate !== null).length,
        certificationIssued: p.forms.some(
          (f) => f.formType === "CERTIFICATION" && f.status === "verified"
        ),
        certificationAt: cert?.uploadedAt
          ? (cert.uploadedAt as Date).toISOString()
          : null,
        lastMeetingAt:
          meetings.length > 0 && meetings[0].meetingDatetime
            ? (meetings[0].meetingDatetime as Date).toISOString()
            : null,
        timeline,
      };
    }),
    ...earlyCases,
  ];

  // Legacy shape: no pagination params → bare array.
  if (!hasPaginationParams) {
    return merged;
  }
  // Tile stats stay UNFILTERED; `total` is the filtered pager count.
  const unfilteredTotal = merged.length;
  const filtered = q
    ? merged.filter((c) => {
        const hay = [c.studentName, c.lrn, c.section, c.stageLabel, c.referralStatus]
          .filter((v) => typeof v === "string")
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : merged;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Deep-link landing (?highlight=<id>): serve the page containing
  // the case (matched by case id or referral id) so bell links land
  // with highlight, no extra round-trip.
  let safePage = Math.min(page, totalPages);
  if (highlight) {
    const idx = filtered.findIndex((c) => {
      const row = c as unknown as { id?: unknown; referralId?: unknown };
      return row.id === highlight || row.referralId === highlight;
    });
    if (idx >= 0) safePage = Math.floor(idx / pageSize) + 1;
  }
  const start = (safePage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  return {
    data: rows,
    rows,
    cases: rows,
    total,
    unfilteredTotal,
    summary: { total: unfilteredTotal, filtered: total },
    page: safePage,
    totalPages,
    limit: pageSize,
    pageSize,
  };
}
