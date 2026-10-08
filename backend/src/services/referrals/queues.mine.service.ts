import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { ADM_STAGE_FLOW } from "../adm.js";
import { TIMELINE_DESK_LABELS, buildCaseTimeline } from "../../modules/referrals/timeline.js";
import type { ReferralContext } from "./referral.types.js";

export interface MineQuery {
  hasPaginationParams: boolean;
  page: number;
  pageSize: number;
  q: string;
  highlight: string;
}

export async function listMine(ctx: ReferralContext, query: MineQuery) {
  const { hasPaginationParams, page, pageSize, q, highlight } = query;
  const teacherId = ctx.userId;
  const sections = await prisma.section.findMany({
    where: { adviserId: teacherId },
    select: { id: true, name: true, gradeLevel: true },
  });
  if (sections.length === 0 && ctx.role === "adviser") {
    throw new AppError(404, "NOT_ADVISER", "No advisory section assigned");
  }
  const sectionIds = sections.map((s) => s.id);

  const scopeTermId = ctx.termId;
  const referralWhere = {
    referredBy: teacherId,
    ...(scopeTermId ? { termId: scopeTermId } : {}),
    ...(sectionIds.length > 0
      ? {
          OR: [
            { student: { sectionId: { in: sectionIds } } },
            { roster: { sectionId: { in: sectionIds } } },
          ],
        }
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
      roster: {
        select: {
          lrn: true,
          fullName: true,
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
          modules: { select: { submitted: true, submissionDate: true } },
          devices: { select: { returnedDate: true } },
          forms: { select: { formType: true, status: true, uploadedAt: true } },
        },
      },
    },
    orderBy: { id: "desc" },
  });

  const referralIds = referrals.map((r) => r.id);

  const timelines = await buildCaseTimeline(referralIds);

  const approverIds = [
    ...new Set(
      referrals
        .map((r) => r.admProfiles[0]?.approvedBy ?? null)
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

  const admLabelByStage = new Map(ADM_STAGE_FLOW.map((s) => [s.stage, s.label]));

  const formatted = referrals.map((r) => {
    const isAdm = r.referredToRole === "adm_coordinator";
    const profile = r.admProfiles[0] ?? null;
    const meetings = profile?.parentMeetings ?? [];
    const hasParentMeeting = meetings.length > 0;
    const meetingAttended = meetings.length > 0 ? meetings.some((m) => m.attended) : null;
    const hasHomeVisit = r.homeVisitations.length > 0;

    const admStage = isAdm ? (profile?.stage ?? "consultation") : null;

    const timeline = timelines.get(r.id) ?? [];
    const referredAt =
      timeline[0]?.at ?? new Date().toISOString();
    if (timeline.length === 0) {
      timeline.push({
        label: `Submitted to the ${TIMELINE_DESK_LABELS[r.referredToRole] ?? "receiving desk"}.`,
        detail: null,
        date: referredAt.slice(0, 10),
        at: referredAt,
        action: "referral_submitted",
        byRole: null,
        source: "case",
      });
    }
    if (profile) {
      timeline.push({
        label: `Moved to the ${admLabelByStage.get(profile.stage) ?? profile.stage} stage.`,
        detail: null,
        date: profile.createdAt.toISOString().slice(0, 10),
        at: profile.createdAt.toISOString(),
        action: "adm_stage",
        byRole: "adm_coordinator",
        source: "case",
        stage: profile.stage,
      });
    }
    if (profile?.approvedBy && profile.approvedAt) {
      timeline.push({
        label: "The principal signed the approval.",
        detail: null,
        date: profile.approvedAt.toISOString().slice(0, 10),
        at: profile.approvedAt.toISOString(),
        action: "adm_approved",
        byRole: approverRoles.get(profile.approvedBy) ?? "principal",
        source: "case",
      });
    }

    return {
      id: r.id,
      studentName: r.student?.user.fullName ?? r.roster?.fullName ?? "",
      lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
      section: r.student?.section?.name ?? r.roster?.section?.name ?? "",
      targetRole: r.referredToRole,
      referredBy: r.referredBy,
      reason: r.reason,
      status: r.status,
      referredAt,
      resolvedAt: r.status === "resolved" ? (timeline[timeline.length - 1]?.at ?? new Date().toISOString()) : null,
      anecdotalId: r.anecdotalRecordId,
      observationDate: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
      anecdotalExcerpt: r.anecdotalRecord.descriptionOfIncident,
      category: r.anecdotalRecord.category,
      track: isAdm ? "adm" : "general",

      admReceiver: isAdm ? (r.consultReviewer ?? "adm_coordinator") : null,
      consultReviewer: r.consultReviewer ?? null,
      hasParentMeeting,
      meetingAttended,
      hasHomeVisit,
      admStage,
      admStageLabel: admStage ? (admLabelByStage.get(admStage) ?? admStage) : null,
      admEligibility: profile?.eligibilityStatus ?? null,
      admApproved: !!profile?.approvedBy,
      admApprovedAt: profile?.approvedAt ? profile.approvedAt.toISOString() : null,

      modulesSubmitted: (profile?.modules ?? []).filter((m) => m.submitted).length,
      modulesTotal: (profile?.modules ?? []).length,
      lastModuleAt: (() => {
        const dates = (profile?.modules ?? [])
          .filter((m) => m.submitted && m.submissionDate)
          .map((m) => (m.submissionDate as Date).toISOString());
        return dates.length > 0 ? dates.sort().slice(-1)[0] : null;
      })(),
      devicesReturned: (profile?.devices ?? []).filter((d) => d.returnedDate !== null).length,
      certificationAt: (() => {
        const cert = (profile?.forms ?? []).find(
          (f) => f.formType === "CERTIFICATION" && f.status === "verified" && f.uploadedAt
        );
        return cert?.uploadedAt ? (cert.uploadedAt as Date).toISOString() : null;
      })(),
      lastMeetingAt:
        meetings.length > 0 && meetings[0].meetingDatetime
          ? (meetings[0].meetingDatetime as Date).toISOString()
          : null,
      timeline,
      notes: r.notes,
      escalationReason: r.escalationReason,
      followUpDate: r.followUpDate,
      escalatedTo: r.escalatedTo,
    };
  });

  if (!hasPaginationParams) {
    return formatted;
  }

  const unfilteredTotal = formatted.length;
  const filtered = q
    ? formatted.filter((r) => {
        const hay = [
          r.studentName,
          r.lrn,
          r.section,
          r.reason,
          r.category,
          r.status,
          r.anecdotalExcerpt,
        ]
          .filter((v) => typeof v === "string")
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : formatted;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  let safePage = Math.min(page, totalPages);
  if (highlight) {
    const idx = filtered.findIndex(
      (r) => (r as { id?: unknown }).id === highlight
    );
    if (idx >= 0) safePage = Math.floor(idx / pageSize) + 1;
  }
  const start = (safePage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  return {
    data: rows,
    rows,
    referrals: rows,
    total,
    unfilteredTotal,
    summary: { total: unfilteredTotal, filtered: total },
    page: safePage,
    totalPages,
    limit: pageSize,
    pageSize,
  };
}
