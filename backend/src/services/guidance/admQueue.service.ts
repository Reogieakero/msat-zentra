import { prisma } from "../../lib/prisma.js";
import { sectionHeadcounts } from "../enrollment.js";
import {
  computeRiskFactors,
  levelFromFlags,
} from "../risk.js";
import {
  ADM_LABEL,
  GRADE_LABELS,
  type AdmStage,
} from "../../modules/guidance/guidance.repository.js";
import type { GuidanceContext } from "./guidance.types.js";

export interface AdmQueueQuery {
  stageFilter: string;
  q: string;
  page: number;
  pageSize: number;
}

export async function getAdmQueue(ctx: GuidanceContext, query: AdmQueueQuery, riskTermId: string | null) {
  const { stageFilter, q, page, pageSize } = query;

  const scopeTermId = ctx.termId;
  const effPageSize = Math.min(Math.max(1, Math.floor(pageSize) || 15), 15);
  const needle = q.trim();

  const profileScope: any = scopeTermId ? { termId: scopeTermId } : {};
  const earlyScope: any = {
    referredToRole: "adm_coordinator",
    admProfiles: { none: {} },
    ...(scopeTermId ? { termId: scopeTermId } : {}),
    OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
  };

  const profileSearch = needle
    ? {
        OR: [
          { student: { user: { fullName: { contains: needle, mode: "insensitive" } } } },
          { student: { lrn: { contains: needle, mode: "insensitive" } } },
          { student: { section: { name: { contains: needle, mode: "insensitive" } } } },
          { referral: { reason: { contains: needle, mode: "insensitive" } } },
          { referral: { referredByUser: { fullName: { contains: needle, mode: "insensitive" } } } },
        ],
      }
    : null;
  const earlySearch = needle
    ? {
        OR: [
          { student: { user: { fullName: { contains: needle, mode: "insensitive" } } } },
          { student: { lrn: { contains: needle, mode: "insensitive" } } },
          { student: { section: { name: { contains: needle, mode: "insensitive" } } } },
          { roster: { fullName: { contains: needle, mode: "insensitive" } } },
          { roster: { lrn: { contains: needle, mode: "insensitive" } } },
          { roster: { section: { name: { contains: needle, mode: "insensitive" } } } },
          { reason: { contains: needle, mode: "insensitive" } },
          { referredByUser: { fullName: { contains: needle, mode: "insensitive" } } },
        ],
      }
    : null;

  const wantProfiles = !stageFilter || stageFilter !== "consultation";
  const wantEarly = !stageFilter || stageFilter === "consultation";
  const profilesWhere: any = {
    AND: [
      profileScope,
      ...(stageFilter && stageFilter !== "consultation" ? [{ stage: stageFilter }] : []),
      ...(profileSearch ? [profileSearch] : []),
    ],
  };
  const earlyWhere: any = {
    AND: [earlyScope, ...(earlySearch ? [earlySearch] : [])],
  };

  const [profileCountAll, earlyCountAll, profileTotal, earlyTotal, profileStageGroups] =
    await Promise.all([
      prisma.admLearnerProfile.count({ where: profileScope }),
      prisma.referral.count({ where: earlyScope }),
      wantProfiles ? prisma.admLearnerProfile.count({ where: profilesWhere }) : Promise.resolve(0),
      wantEarly ? prisma.referral.count({ where: earlyWhere }) : Promise.resolve(0),
      prisma.admLearnerProfile.groupBy({
        by: ["stage"],
        where: profileScope,
        _count: { _all: true },
      }),
    ]);

  const unfilteredTotal = profileCountAll + earlyCountAll;
  const total = profileTotal + earlyTotal;
  const totalPages = Math.max(1, Math.ceil(total / effPageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const windowTake = safePage * effPageSize;

  const [profileIdRows, earlyIdRows] = await Promise.all([
    wantProfiles
      ? prisma.admLearnerProfile.findMany({
          where: profilesWhere,
          select: {
            id: true,
            createdAt: true,
            referral: { select: { anecdotalRecord: { select: { observationDatetime: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: windowTake,
        })
      : Promise.resolve([]),
    wantEarly
      ? prisma.referral.findMany({
          where: earlyWhere,
          select: { id: true, anecdotalRecord: { select: { observationDatetime: true } } },
          orderBy: [{ anecdotalRecord: { observationDatetime: "desc" } }, { id: "desc" }],
          take: windowTake,
        })
      : Promise.resolve([]),
  ]);

  const dateOfProfile = (r: { createdAt: Date; referral: { anecdotalRecord: { observationDatetime: Date } | null } }) =>
    r.referral.anecdotalRecord?.observationDatetime.toISOString().slice(0, 10) ??
    r.createdAt.toISOString().slice(0, 10);
  const mergedIds = [
    ...profileIdRows.map((r) => ({ kind: "profile" as const, id: r.id, date: dateOfProfile(r), rank: 0 })),
    ...earlyIdRows.map((r) => ({
      kind: "early" as const,
      id: r.id,
      date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
      rank: 1,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.rank - b.rank);
  const windowIds = mergedIds.slice((safePage - 1) * effPageSize, safePage * effPageSize);
  const windowProfileIds = windowIds.filter((w) => w.kind === "profile").map((w) => w.id);
  const windowEarlyIds = windowIds.filter((w) => w.kind === "early").map((w) => w.id);
  const reviewTopIds = earlyIdRows.slice(0, 3).map((r) => r.id);
  const hydrateEarlyIds = [...new Set([...windowEarlyIds, ...reviewTopIds])];

  const [profiles, earlyReferrals, counselor] = await Promise.all([
    windowProfileIds.length
      ? prisma.admLearnerProfile.findMany({
          where: { id: { in: windowProfileIds } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            stage: true,
            eligibilityStatus: true,
            createdAt: true,
            approvedBy: true,
            approvedAt: true,
            preparedByUser: { select: { fullName: true } },
            parentMeetings: { select: { attended: true } },
            student: {
              select: {
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
                section: { select: { name: true } },
              },
            },
            referral: {
              select: {
                id: true,
                status: true,
                reason: true,
                consultReviewer: true,
                notes: true,
                referredByUser: { select: { fullName: true } },
                anecdotalRecord: { select: { observationDatetime: true } },
                homeVisitations: { select: { id: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    hydrateEarlyIds.length
      ? prisma.referral.findMany({
          where: { id: { in: hydrateEarlyIds } },
          orderBy: [{ anecdotalRecord: { observationDatetime: "desc" } }, { id: "desc" }],
          select: {
            id: true,
            status: true,
            reason: true,
            consultReviewer: true,
            consultReviewedAt: true,
            notes: true,
            referredByUser: { select: { fullName: true } },
            homeVisitations: { select: { id: true } },
            counselingSessions: { select: { id: true, status: true } },
            anecdotalRecord: {
              select: {
                id: true,
                category: true,
                observationDatetime: true,
                descriptionOfIncident: true,
                descriptionOfLocation: true,
                notesRecommendationsActions: true,
              },
            },
            student: {
              select: {
                userId: true,
                lrn: true,
                gradeLevel: true,
                user: { select: { fullName: true } },
                section: { select: { id: true, name: true } },
              },
            },
            roster: {
              select: {
                id: true,
                lrn: true,
                fullName: true,
                gradeLevel: true,
                section: { select: { id: true, name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { fullName: true },
    }),
  ]);
  const profileOrder = new Map(windowProfileIds.map((id, i) => [id, i]));
  profiles.sort((a, b) => (profileOrder.get(a.id) ?? 0) - (profileOrder.get(b.id) ?? 0));
  const earlyOrder = new Map(hydrateEarlyIds.map((id, i) => [id, i]));
  earlyReferrals.sort((a, b) => (earlyOrder.get(a.id) ?? 0) - (earlyOrder.get(b.id) ?? 0));

  const reviewedClause = { consultReviewedAt: { not: null } };
  const [awaitingReview, reviewedCount] = await Promise.all([
    prisma.referral.count({ where: { AND: [earlyScope, { consultReviewedAt: null }] } }),
    prisma.referral.count({ where: { AND: [earlyScope, reviewedClause] } }),
  ]);

  const riskByReferral = new Map<string, string>();
  {
    const termId = riskTermId;
    if (termId && earlyReferrals.length > 0) {
      try {
        const userIds = [
          ...new Set(
            earlyReferrals
              .map((r) => r.student?.userId ?? null)
              .filter((v): v is string => !!v)
          ),
        ];
        const rosterIds = [
          ...new Set(
            earlyReferrals
              .map((r) => r.roster?.id ?? null)
              .filter((v): v is string => !!v)
          ),
        ];
        const sectionIds = [
          ...new Set(
            earlyReferrals
              .flatMap((r) => [r.student?.section?.id, r.roster?.section?.id])
              .filter((v): v is string => !!v)
          ),
        ];
        const idOr = [
          ...(userIds.length ? [{ studentId: { in: userIds } }] : []),
          ...(rosterIds.length ? [{ rosterId: { in: rosterIds } }] : []),
        ];
        const [grades, attendance, anecdStudents, anecdRosters, headcounts] =
          await Promise.all([
            idOr.length
              ? prisma.finalGrade.findMany({
                  where: { termId, OR: idOr },
                  select: {
                    studentId: true,
                    rosterId: true,
                    computedAverage: true,
                    transmutedGrade: true,
                  },
                })
              : [],
            idOr.length
              ? prisma.attendanceRecord.findMany({
                  where: { termId, OR: idOr },
                  select: {
                    studentId: true,
                    rosterId: true,
                    status: true,
                    subjectId: true,
                  },
                })
              : [],
            userIds.length
              ? prisma.anecdotalRecord.groupBy({
                  by: ["studentId"],
                  where: { termId, studentId: { in: userIds } },
                  _count: { _all: true },
                })
              : [],
            rosterIds.length
              ? prisma.anecdotalRecord.groupBy({
                  by: ["rosterId"],
                  where: { termId, rosterId: { in: rosterIds } },
                  _count: { _all: true },
                })
              : [],
            sectionHeadcounts(sectionIds),
          ]);
        const gradesByKey = new Map<string, { computedAverage: number | null; transmutedGrade: number | null }[]>();
        for (const g of grades) {
          const key = g.studentId ?? (g.rosterId ? `roster:${g.rosterId}` : null);
          if (!key) continue;
          const list = gradesByKey.get(key) ?? [];
          list.push({ computedAverage: g.computedAverage, transmutedGrade: g.transmutedGrade });
          gradesByKey.set(key, list);
        }
        const attendanceByKey = new Map<string, { status: string; subjectId: string | null }[]>();
        for (const a of attendance) {
          const key = a.studentId ?? (a.rosterId ? `roster:${a.rosterId}` : null);
          if (!key) continue;
          const list = attendanceByKey.get(key) ?? [];
          list.push({ status: a.status, subjectId: a.subjectId });
          attendanceByKey.set(key, list);
        }
        const anecdByKey = new Map<string, number>();
        for (const c of anecdStudents) {
          if (c.studentId) anecdByKey.set(c.studentId, c._count._all);
        }
        for (const c of anecdRosters) {
          if (c.rosterId) anecdByKey.set(`roster:${c.rosterId}`, c._count._all);
        }
        for (const r of earlyReferrals) {
          const key = r.student?.userId ?? (r.roster?.id ? `roster:${r.roster.id}` : null);
          if (!key) continue;
          const sectionId = r.student?.section?.id ?? r.roster?.section?.id ?? "";
          const flags = computeRiskFactors({
            finalGrades: gradesByKey.get(key) ?? [],
            attendance: attendanceByKey.get(key) ?? [],
            anecdotalCount: anecdByKey.get(key) ?? 0,
            enrolled: headcounts.get(sectionId) ?? 0,
          });
          riskByReferral.set(r.id, levelFromFlags(flags));
        }
      } catch {
      }
    }
  }

  const profileRows = profiles.map((p) => {
    const meetings = p.parentMeetings ?? [];
    return {
      id: p.id,
      student: p.student.user.fullName,
      lrn: p.student.lrn,
      section: p.student.section?.name ?? "—",
      grade: GRADE_LABELS[p.student.gradeLevel] ?? p.student.gradeLevel,
      stage: p.stage,
      stageLabel: ADM_LABEL.get(p.stage as AdmStage) ?? p.stage,
      eligibility: p.eligibilityStatus,
      referralId: p.referral.id,
      consultReviewer: p.referral.consultReviewer ?? null,
      referralStatus: p.referral.status,
      reason: p.referral.reason,
      consultNote: p.referral.notes ?? null,
      referredBy: p.referral.referredByUser?.fullName ?? "Adviser",
      preparedBy: p.preparedByUser?.fullName ?? "—",
      date:
        p.referral.anecdotalRecord?.observationDatetime
          .toISOString()
          .slice(0, 10) ??
        p.createdAt.toISOString().slice(0, 10),
      meetingAttended:
        meetings.length > 0 ? meetings.some((m) => m.attended) : null,
      hasHomeVisit: p.referral.homeVisitations.length > 0,
      approved: !!p.approvedBy,
      approvedAt: p.approvedAt
        ? p.approvedAt.toISOString().slice(0, 10)
        : null,
    };
  });

  const toEarlyRow = (r: (typeof earlyReferrals)[number]) => ({
    id: `referral:${r.id}`,
    student:
      r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
    grade:
      GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ??
      "",
    stage: "consultation",
    stageLabel: ADM_LABEL.get("consultation" as AdmStage) ?? "Consultation and referral",
    eligibility: "pending",
    referralId: r.id,
    referralStatus: r.status,
    reason: r.reason,
    referredBy: r.referredByUser?.fullName ?? "Adviser",
    preparedBy: r.referredByUser?.fullName ?? "Adviser",
    date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
    meetingAttended: null as boolean | null,
    hasHomeVisit: r.homeVisitations.length > 0,
    approved: false,
    approvedAt: null as string | null,
    anecdotalId: r.anecdotalRecord.id,
    consultReviewer: r.consultReviewer ?? "guidance_counselor",
    anecdotalExcerpt: r.anecdotalRecord.descriptionOfIncident,
    category: r.anecdotalRecord.category,
    consultNote: r.notes ?? null,
    location: r.anecdotalRecord.descriptionOfLocation ?? "",
    recommendations: r.anecdotalRecord.notesRecommendationsActions ?? "",
    reviewed: r.consultReviewedAt != null,
    hasBookedSession: r.counselingSessions.some((s) => s.status === "scheduled"),
    riskLevel: riskByReferral.get(r.id) ?? null,
  });

  const windowEarlyById = new Map(windowEarlyIds.map((id) => [id, true]));
  const pageEarlyRows = earlyReferrals.filter((r) => windowEarlyById.has(r.id)).map(toEarlyRow);
  const reviewTopById = new Map(reviewTopIds.map((id) => [id, true]));
  const reviewRows = earlyReferrals.filter((r) => reviewTopById.has(r.id)).map(toEarlyRow);

  const merged = [...profileRows, ...pageEarlyRows].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const stageCountBy = (stage: string) =>
    profileStageGroups.find((g) => g.stage === stage)?._count._all ?? 0;

  const reviewerScope: any = {
    ...(scopeTermId ? { termId: scopeTermId } : {}),
    OR: [
      { referral: { consultReviewer: null } },
      { referral: { consultReviewer: "guidance_counselor" } },
    ],
  };
  const [
    needsHomeVisit,
    scopedProfileTotal,
    bookedSession,
    followupAction,
    endorsedAction,
    rejectedAction,
    consultActionTotal,
    consultActionRows,
  ] = await Promise.all([
    prisma.admLearnerProfile.count({
      where: {
        ...profileScope,
        parentMeetings: { some: {} },
        NOT: { parentMeetings: { some: { attended: true } } },
        referral: { homeVisitations: { none: {} } },
      },
    }),
    prisma.admLearnerProfile.count({ where: reviewerScope }),
    prisma.referral.count({
      where: { AND: [earlyScope, reviewedClause, { counselingSessions: { some: { status: "scheduled" } } }] },
    }),
    prisma.referral.count({
      where: { AND: [earlyScope, reviewedClause, { status: "follow_up" }, { counselingSessions: { none: { status: "scheduled" } } }] },
    }),
    prisma.referral.count({
      where: { AND: [earlyScope, reviewedClause, { status: "in_progress" }, { counselingSessions: { none: { status: "scheduled" } } }] },
    }),
    prisma.referral.count({ where: { AND: [earlyScope, { status: "dismissed" }] } }),
    prisma.referral.count({
      where: {
        referredToRole: "guidance_counselor",
        status: { in: ["pending", "in_progress"] },
        ...(scopeTermId ? { termId: scopeTermId } : {}),
      },
    }),
    prisma.referral.findMany({
      where: {
        referredToRole: "guidance_counselor",
        status: { in: ["pending", "in_progress"] },
        ...(scopeTermId ? { termId: scopeTermId } : {}),
      },
      orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
      take: 15,
      select: {
        id: true,
        status: true,
        reason: true,
        priority: true,
        referredByUser: { select: { fullName: true } },
        anecdotalRecord: {
          select: { category: true, observationDatetime: true },
        },
        counselingSessions: { select: { id: true, status: true } },
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
      },
    }),
  ]);


  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayMs = 86_400_000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * dayMs);
  const weekBounds = Array.from({ length: 12 }, (_, i) => {
    const weekStart = new Date(thisMonday.getTime() - (11 - i) * 7 * dayMs);
    return { start: weekStart, end: new Date(weekStart.getTime() + 7 * dayMs) };
  });
  const trendCounts = await Promise.all(
    weekBounds.flatMap(({ start, end }) => [
      prisma.admLearnerProfile.count({
        where: {
          ...reviewerScope,
          referral: { anecdotalRecord: { observationDatetime: { gte: start, lt: end } } },
        },
      }),
      prisma.referral.count({
        where: {
          ...earlyScope,
          anecdotalRecord: { observationDatetime: { gte: start, lt: end } },
        },
      }),
    ]),
  );
  const referralTrend = weekBounds.map(({ start }, i) => ({
    week: start.toISOString().slice(0, 10),
    label: `${MONTHS[start.getMonth()]} ${start.getDate()}`,
    count: (trendCounts[i * 2] ?? 0) + (trendCounts[i * 2 + 1] ?? 0),
  }));

  const summary = {
    total: unfilteredTotal,
    consultation: earlyCountAll,
    meetingParents: stageCountBy("meeting_parents"),
    homeVisitation: stageCountBy("home_visitation"),
    certification: stageCountBy("certification"),
    principalApproval: stageCountBy("principal_approval"),
    needsHomeVisit,
    awaitingReview,
    reviewed: reviewedCount,
    scopedTotal: scopedProfileTotal + earlyCountAll,
    referralTrend,
    byAction: [
      { action: "needs_review", label: "Needs review", count: awaitingReview },
      { action: "booked_session", label: "Booked session", count: bookedSession },
      { action: "followup", label: "Follow-up", count: followupAction },
      { action: "endorsed", label: "Endorsed", count: endorsedAction },
      { action: "rejected", label: "Rejected", count: rejectedAction },
    ],
  };

  const consultationQueue = consultActionRows.map((r) => ({
    id: r.id,
    student:
      r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
    grade:
      GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ??
      "",
    category: r.anecdotalRecord.category,
    reason: r.reason,
    status: r.status,
    priority: r.priority ?? "",
    referredBy: r.referredByUser?.fullName ?? "Adviser",
    date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
    completedSessions: r.counselingSessions.filter(
      (s) => s.status === "completed"
    ).length,
    totalSessions: r.counselingSessions.length,
  }));

  return {
    summary: {
      ...summary,
      consultationAction: consultActionTotal,
    },
    counselorName: counselor?.fullName ?? "Guidance Counselor",
    consultationQueue,
    reviewQueue: reviewRows.slice(0, 3),
    cases: merged,
    page: safePage,
    pageSize: effPageSize,
    total,
    totalPages,
    unfilteredTotal,
  };
}
