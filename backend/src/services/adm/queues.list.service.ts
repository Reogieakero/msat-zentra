import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { AdmStage } from "../adm.js";
import { ELIGIBILITY_LABEL, ENROLLED_STAGES, GRADE_LABEL, RECENT_APPROVAL_DAYS, REFERRAL_STAGES } from "../../modules/adm/adm.repository.js";
import type { AdmContext } from "./adm.types.js";

export async function listReferrals(ctx: AdmContext) {
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

    return ctx.role === "principal" ? base : { ...base, studentId: p.studentId };
  });
  return out;
}

export interface AllReferralsQuery {
  page: number;
  limit: number;
  q: string;
  stageParam: string;
  eligibilityParam: string;
}

export async function listAllReferrals(ctx: AdmContext, query: AllReferralsQuery) {
  const { page, limit, q, stageParam, eligibilityParam } = query;
  const skip = (page - 1) * limit;
  const ACTIVE_STAGES: AdmStage[] = [...REFERRAL_STAGES, "consultation", ...ENROLLED_STAGES];
  const stageFilter: AdmStage | "" =
    stageParam && (ACTIVE_STAGES as string[]).includes(stageParam)
      ? (stageParam as AdmStage)
      : "";

  const eligibilityFilter: "pending" | "eligible" | "ineligible" | "" =
    eligibilityParam === "pending" ||
    eligibilityParam === "eligible" ||
    eligibilityParam === "ineligible"
      ? eligibilityParam
      : "";

  const recentApprovalWhere: Prisma.AdmLearnerProfileWhereInput = {
    stage: { in: ENROLLED_STAGES },
    approvedAt: {
      gte: new Date(Date.now() - RECENT_APPROVAL_DAYS * 86_400_000),
    },
  };
  const effectiveStageFilter: AdmStage | { in: AdmStage[] } =
    stageFilter === "principal_approval" && ctx.role === "principal"
      ? { in: ["principal_approval", "enrollment_monitoring"] as AdmStage[] }
      : (stageFilter as AdmStage);
  const where: Prisma.AdmLearnerProfileWhereInput = {
    ...(stageFilter && stageFilter !== "consultation"
      ? { stage: effectiveStageFilter }
      : stageFilter === ""
        ? { OR: [{ stage: { in: REFERRAL_STAGES } }, recentApprovalWhere] }
        : { OR: [recentApprovalWhere] }),
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

  const includeEarly =
    (!stageFilter || stageFilter === "consultation") &&
    (!eligibilityFilter || eligibilityFilter === "pending");

  const earlyWhere: Prisma.ReferralWhereInput = {
    referredToRole: "adm_coordinator",
    admProfiles: { none: {} },
    NOT: {
      status: "pending",
      consultReviewer: { in: ["nurse", "guidance_counselor"] },
    },
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

  const useDbPaging = !includeEarly;
  const [profileItems, stageGroups, totalReferredProfiles, earlyItems, totalProfiles] = await Promise.all([
    prisma.admLearnerProfile.findMany({
      where,
      include: {
        student: {
          select: {
            lrn: true,
            gradeLevel: true,
            user: { select: { fullName: true } },
            section: { select: { name: true } },
          },
        },

        referral: { select: { anecdotalRecordId: true, status: true, consultReviewer: true } },
        preparedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" }, take: 8 },

        parentMeetings: {
          orderBy: { meetingDatetime: "desc" },
          take: 1,
          include: { invitees: { select: { userId: true } } },
        },

        modules: { select: { submitted: true } },
      },

      orderBy: [
        { approvedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
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
                section: { select: { name: true } },
              },
            },
            roster: {
              select: {
                lrn: true,
                fullName: true,
                gradeLevel: true,
                section: { select: { name: true } },
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
    const latestMeeting = (p as unknown as { parentMeetings?: { id: string; meetingDatetime: Date; venue: string; attended: boolean; invitees?: { userId: string }[] }[] }).parentMeetings?.[0] ?? null;
    const base = {
      id: p.id,
      lrn: p.student.lrn,
      student: p.student.user.fullName,
      grade: GRADE_LABEL[p.student.gradeLevel] ?? p.student.gradeLevel,
      section: p.student.section?.name ?? "",
      anecdotalRecordId: p.referral?.anecdotalRecordId ?? null,
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

      referralStatus: p.referral?.status ?? null,

      consultReviewer: p.referral?.consultReviewer ?? null,
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
            inviteeIds: (latestMeeting.invitees ?? []).map((i) => i.userId),
          }
        : null,

      modulesSubmitted: p.modules.filter((m) => m.submitted).length,
      modulesTotal: p.modules.length,
    };

    return ctx.role === "principal" ? base : { ...base, studentId: p.studentId };
  });

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

  const meetingByReferralId = new Map<string, { id: string; datetime: string; venue: string; attended: boolean; inviteeIds: string[] }>();
  if (earlyItems.length > 0) {
    const referralMeetings = await prisma.admParentMeeting.findMany({
      where: { referralId: { in: earlyItems.map((r) => r.id) } },
      include: { invitees: { select: { userId: true } } },
      orderBy: { meetingDatetime: "desc" },
    });
    for (const m of referralMeetings) {
      if (m.referralId && !meetingByReferralId.has(m.referralId)) {
        meetingByReferralId.set(m.referralId, {
          id: m.id,
          datetime: m.meetingDatetime.toISOString(),
          venue: m.venue,
          attended: m.attended,
          inviteeIds: m.invitees.map((i) => i.userId),
        });
      }
    }
  }

  const earlyRows = earlyItems.map((r) => {
    const base = {
      id: `referral:${r.id}`,
      lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
      student: r.student?.user.fullName ?? r.roster?.fullName ?? "",
      grade: GRADE_LABEL[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
      section: r.student?.section?.name ?? r.roster?.section?.name ?? "",
      anecdotalRecordId: r.anecdotalRecordId ?? null,
      stage: "consultation" as const,
      eligibilityStatus: "pending" as const,
      preparedBy: r.referredByUser.fullName,
      datePrepared: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),

      endorsedAt: endorsedAtById.get(r.id) ?? null,
      approvedBy: null as string | null,
      approvalDate: null as string | null,

      consultReviewer: r.consultReviewer ?? null,
      referralStatus: r.status,
      forms: [] as { id: string; formType: string; title: string; status: string }[],
      meeting: meetingByReferralId.get(r.id) ?? null,

      modulesSubmitted: 0,
      modulesTotal: 0,
    };
    return ctx.role === "principal" ? base : { ...base, studentId: "" };
  });

  const sortKey = (row: {
    datePrepared: string | null;
    endorsedAt?: string | null;
    approvalDate?: string | null;
  }) =>
    row.approvalDate ??
    (row.endorsedAt ? String(row.endorsedAt).slice(0, 10) : (row.datePrepared ?? ""));
  const merged = [...profileRows, ...earlyRows].sort((a, b) =>
    sortKey(b).localeCompare(sortKey(a)),
  );

  const total = useDbPaging ? totalProfiles : merged.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(page, totalPages);
  const slice = useDbPaging
    ? merged
    : merged.slice((clampedPage - 1) * limit, clampedPage * limit);

  const withAction = await (async () => {
    const refIds = new Set<string>();
    const profIds = new Set<string>();
    const meetingIds = new Set<string>();
    const referralByProfile = new Map(profileItems.map((p) => [p.id, p.referralId]));
    const profileByReferral = new Map<string, string>();
    for (const [pid, rid] of referralByProfile) {
      if (!profileByReferral.has(rid)) profileByReferral.set(rid, pid);
    }
    const meetingToCase = new Map<string, string>();
    for (const row of slice as { id: string; meeting?: { id: string } | null }[]) {
      if (row.id.startsWith("referral:")) {
        const rid = row.id.slice("referral:".length);
        refIds.add(rid);
        if (row.meeting) {
          meetingIds.add(row.meeting.id);
          meetingToCase.set(row.meeting.id, row.id);
        }
      } else {
        profIds.add(row.id);
        const rid = referralByProfile.get(row.id);
        if (rid) refIds.add(rid);
        if (row.meeting) {
          meetingIds.add(row.meeting.id);
          meetingToCase.set(row.meeting.id, row.id);
        }
      }
    }
    const lastActionByCase = new Map<string, { type: string; at: string }>();
    if (refIds.size > 0 || profIds.size > 0 || meetingIds.size > 0) {
      const logs = await prisma.auditLog.findMany({
        where: {
          OR: [
            ...(refIds.size > 0 ? [{ sourceTable: "referrals", sourceId: { in: [...refIds] } }] : []),
            ...(profIds.size > 0 ? [{ sourceTable: "adm_learner_profiles", sourceId: { in: [...profIds] } }] : []),
            ...(meetingIds.size > 0 ? [{ sourceTable: "adm_parent_meetings", sourceId: { in: [...meetingIds] } }] : []),
          ],
        },
        select: { sourceId: true, sourceTable: true, actionType: true, createdAt: true },
        orderBy: { createdAt: "desc" },

        take: 1000,
      });
      for (const log of logs) {
        let caseKey: string | null = null;
        if (log.sourceTable === "referrals") {
          const pid = profileByReferral.get(log.sourceId);
          caseKey = pid ?? `referral:${log.sourceId}`;
        } else if (log.sourceTable === "adm_learner_profiles") {
          caseKey = log.sourceId;
        } else {
          caseKey = meetingToCase.get(log.sourceId) ?? null;
        }
        if (!caseKey || lastActionByCase.has(caseKey)) continue;
        lastActionByCase.set(caseKey, {
          type: String(log.actionType),
          at: log.createdAt.toISOString(),
        });
      }
    }
    return slice.map((row) => ({
      ...row,
      lastActionAt: lastActionByCase.get(row.id)?.at ?? null,
      lastActionType: lastActionByCase.get(row.id)?.type ?? null,
    }));
  })();

  return {
    rows: withAction,
    total,
    unfilteredTotal: totalReferred,
    complete: totalReferred,
    totalReferred,
    stageCounts: countsByStage,
    page: clampedPage,
    totalPages,
    limit,
    pageSize: limit,
  };
}
