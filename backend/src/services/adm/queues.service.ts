import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { AdmStage } from "../adm.js";
import {
  ELIGIBILITY_LABEL,
  ENROLLED_STAGES,
  GRADE_LABEL,
  RECENT_APPROVAL_DAYS,
  REFERRAL_STAGES,
} from "../../modules/adm/adm.repository.js";
import { AppError } from "../../lib/errors.js";
import type { AdmContext } from "./adm.types.js";

// Coordinator/principal desk queues: referral lists, certification
// approvals, and per-case audit history. Pure reads — no audit, no
// notifications, no cache writes.

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
    // Principal: status-only — strip confidential fields
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
  // Server-side eligibility filter (pending | eligible | ineligible).
  // Unknown/absent values behave as "all" so existing callers are
  // unaffected. Early referral rows are always pending, so a non-pending
  // filter excludes them (see includeEarly below).
  const eligibilityFilter: "pending" | "eligible" | "ineligible" | "" =
    eligibilityParam === "pending" ||
    eligibilityParam === "eligible" ||
    eligibilityParam === "ineligible"
      ? eligibilityParam
      : "";

  // Default (no stage) stays referral-only so the Referrals queue never
  // mixes in enrolled learners — except freshly-signed ones, which stay
  // put while they are the latest: enrolled stages signed within the
  // recent-approval window ride along. The consultation view (overview
  // forwards) likewise keeps window-signed cases. Explicit stage views
  // (certification / principal_approval / enrolled / completion) are
  // untouched.
  // Principals keep seeing endorsed cases after signing: their
  // principal_approval view also includes enrollment_monitoring cases
  // (every one of them passed through endorsement + signature), so a
  // signed case never vanishes from the desk.
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

  // Filed ADM referrals the coordinator hasn't built a learner profile
  // for yet — visible here at the consultation stage instead of vanishing.
  // Roster enlistments without accounts count too. Early rows are always
  // eligibility-pending, so a non-pending eligibility filter skips them
  // (and their extra queries) entirely.
  const includeEarly =
    (!stageFilter || stageFilter === "consultation") &&
    (!eligibilityFilter || eligibilityFilter === "pending");
  // Coordinator queue is ADM-directed only: pre-profile rows are pinned
  // to referredToRole adm_coordinator, and profile rows are ADM learner
  // profiles by nature — no other track may surface on this desk.
  // Endorsement-gated visibility: a case filed with a nurse/guidance
  // consultation reviewer sits at the reviewer's step — it surfaces here
  // only once endorsed (status leaves pending). Direct (no reviewer) and
  // lrpc filings have no reviewer step, so they show immediately;
  // dismissed rows stay visible as the closed-case trail.
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
  // Enrolled/certification views never include early referral rows, so
  // they page in the database (skip/take + count) instead of pulling
  // every matching profile into memory. The referrals queue keeps its
  // merged in-memory paging to preserve early-row interleaving.
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
        // consultReviewer powers the queue's "Referred by" source phrase
        // (Direct referral vs Endorsed by …) on profile-stage rows too —
        // without it the source is lost once the profile is created.
        referral: { select: { anecdotalRecordId: true, status: true, consultReviewer: true } },
        preparedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" }, take: 8 },
        // Invitee ids ride the row snapshot so rescheduling from the
        // table menu prefills (never wipes) the invite list.
        parentMeetings: {
          orderBy: { meetingDatetime: "desc" },
          take: 1,
          include: { invitees: { select: { userId: true } } },
        },
        // Module pass-tracking for the enrolled (monitoring) cards —
        // submitted/total counts per learner profile.
        modules: { select: { submitted: true } },
      },
      // Recently-signed cases float first (nulls last keeps the rest in
      // newest-created order) so a fresh approval stays put as the
      // latest. Unapproved-only views are unaffected — every approvedAt
      // there is null.
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
      // Referral-level terminal state — a cancelled (dismissed) or resolved
      // referral reads as such on the desk, not as a live pipeline stage.
      referralStatus: p.referral?.status ?? null,
      // Endorsement source for the "Referred by" column — the desk that
      // endorsed the case (nurse | guidance_counselor | lrpc), or null
      // when the teacher filed it straight to the ADM Coordinator.
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
      // Module pass-tracking for the enrolled (monitoring) cards.
      modulesSubmitted: p.modules.filter((m) => m.submitted).length,
      modulesTotal: p.modules.length,
    };
    // Principal: status-only — strip confidential fields
    return ctx.role === "principal" ? base : { ...base, studentId: p.studentId };
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

  // Early referrals sit at consultation until the coordinator builds the
  // learner profile. Newest first, then paged in memory.
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
      // Early rows have no profile (hence no modules) — zeros keep the
      // row shape identical to profile rows.
      modulesSubmitted: 0,
      modulesTotal: 0,
    };
    return ctx.role === "principal" ? base : { ...base, studentId: "" };
  });

  // Newest hand-off first: early rows sort by endorse time, profiles by
  // creation date (they carry no endorse timestamp) — except
  // recently-signed ones, which sort by approval date so a fresh
  // approval stays put as the latest (mirrors the DB orderBy above).
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
  // DB-paged views (enrolled, certification) already hold exactly one
  // page of profile rows and a counted total — skip the in-memory slice.
  const total = useDbPaging ? totalProfiles : merged.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const clampedPage = Math.min(page, totalPages);
  const slice = useDbPaging
    ? merged
    : merged.slice((clampedPage - 1) * limit, clampedPage * limit);

  // Latest audit action per case for the Latest action column — one
  // batched read over the page slice (source referrals + profiles +
  // their meetings, the same source set as the /history timeline).
  // Newest-first scan, first hit per case wins.
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
        // Page-bounded read: the slice holds at most `limit` rows, so
        // this cap never truncates real results — it only bounds memory.
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

  // `total` = filtered pager count; tile stats stay UNFILTERED
  // (stageCounts/totalReferred) so backend filtering never shrinks tiles.
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

export interface ApprovalsQuery {
  page: number;
  limit: number;
  q: string;
}

export async function listApprovals(ctx: AdmContext, query: ApprovalsQuery) {
  const { page, limit, q } = query;
  const skip = (page - 1) * limit;
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

  const termId = ctx.termId;

  const [pageItems, total] = await Promise.all([
    prisma.admLearnerProfile.findMany({
      where,
      include: {
        student: {
          select: {
            lrn: true,
            gradeLevel: true,
            sectionId: true,
            user: { select: { fullName: true } },
            section: { select: { name: true } },
          },
        },
        approvedByUser: { select: { fullName: true } },
        preparedByUser: { select: { fullName: true } },
        forms: { orderBy: { uploadedAt: "desc" }, take: 8 },
        modules: { select: { submitted: true } },
        devices: { select: { id: true } },
      },
      orderBy: { approvedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.admLearnerProfile.count({ where }),
  ]);

  // Per-subject academic tracking for the active term (finalized
  // transmuted grades with raw computed averages alongside).
  const gradeRows = termId
    ? await prisma.finalGrade.findMany({
        where: {
          studentId: { in: pageItems.map((p) => p.studentId) },
          termId,
        },
        select: {
          studentId: true,
          computedAverage: true,
          transmutedGrade: true,
          subject: { select: { name: true, code: true } },
        },
      })
    : [];
  const gradesByStudent = new Map<string, typeof gradeRows>();
  for (const g of gradeRows) {
    if (!g.studentId) continue;
    const arr = gradesByStudent.get(g.studentId) ?? [];
    arr.push(g);
    gradesByStudent.set(g.studentId, arr);
  }

  const out = pageItems.map((p) => {
    const base = {
      id: p.id,
      lrn: p.student.lrn,
      student: p.student.user.fullName,
      grade: GRADE_LABEL[p.student.gradeLevel] ?? p.student.gradeLevel,
      section: p.student.sectionId ?? "",
      sectionName: p.student.section?.name ?? "",
      modulesSubmitted: p.modules.filter((m) => m.submitted).length,
      modulesTotal: p.modules.length,
      devicesIssued: p.devices.length,
      subjectGrades: (gradesByStudent.get(p.studentId) ?? []).map((g) => ({
        subject: g.subject.name,
        code: g.subject.code,
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
        belowThreshold: (g.transmutedGrade ?? 100) < 75,
      })),
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
    return ctx.role === "principal" ? base : { ...base, studentId: p.studentId };
  });

  return {
    rows: out,
    total,
    unfilteredTotal: total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    limit,
    pageSize: limit,
  };
}

export interface HistoryQuery {
  profileId: string | null;
  referralId: string | null;
}

// Case history timeline for the coordinator's "See history" action. Returns
// the audit trail across the anecdotal filing, the source referral, the
// learner profile, and its devices — system events only (reasons + stage
// diffs), never clinical write-ups. Oldest first: adviser filing →
// guidance/nurse endorse → coordinator actions → principal decision →
// devices. At least one of profileId / referralId is required.
export async function getHistory(query: HistoryQuery) {
  const { profileId, referralId: referralParam } = query;
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
  return {
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
  };
}
