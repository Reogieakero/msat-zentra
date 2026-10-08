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

  const [profiles, earlyReferrals, consultationReferrals, counselor] =
    await Promise.all([
    prisma.admLearnerProfile.findMany({
      where: scopeTermId ? { termId: scopeTermId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 1000,
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
    }),
    prisma.referral.findMany({
      where: {
        referredToRole: "adm_coordinator",
        admProfiles: { none: {} },
        ...(scopeTermId ? { termId: scopeTermId } : {}),

        OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
      },
      orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
      take: 1000,
      select: {
        id: true,
        status: true,
        reason: true,
        consultReviewer: true,
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
    }),

    prisma.referral.findMany({
      where: {
        referredToRole: "guidance_counselor",
        status: { in: ["pending", "in_progress"] },
        ...(scopeTermId ? { termId: scopeTermId } : {}),
      },
      orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
      take: 100,
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

    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { fullName: true },
    }),
  ]);

  const earlyIds = earlyReferrals.map((r) => r.id);
  const consultAudits = earlyIds.length
    ? await prisma.auditLog.findMany({
        where: {
          sourceTable: "referrals",
          sourceId: { in: earlyIds },
          actionType: { in: ["referral_status_change", "referral_reassigned", "referral_dismissed"] },
          reason: { startsWith: "ADM consultation " },
        },
        select: { sourceId: true, reason: true },
        take: 5000,
      })
    : [];

  const reviewedIds = new Set(
    consultAudits
      .filter((a) => a.reason?.startsWith("ADM consultation "))
      .map((a) => a.sourceId)
  );

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

  const earlyRows = earlyReferrals.map((r) => ({
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
    reviewed: reviewedIds.has(r.id),
    hasBookedSession: r.counselingSessions.some((s) => s.status === "scheduled"),

    riskLevel: null as string | null,
  }));

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
        earlyReferrals.forEach((r, i) => {
          const key = r.student?.userId ?? (r.roster?.id ? `roster:${r.roster.id}` : null);
          if (!key) return;
          const sectionId = r.student?.section?.id ?? r.roster?.section?.id ?? "";
          const flags = computeRiskFactors({
            finalGrades: gradesByKey.get(key) ?? [],
            attendance: attendanceByKey.get(key) ?? [],
            anecdotalCount: anecdByKey.get(key) ?? 0,
            enrolled: headcounts.get(sectionId) ?? 0,
          });
          earlyRows[i].riskLevel = levelFromFlags(flags);
        });
      } catch {

      }
    }
  }

  const merged = [...profileRows, ...earlyRows].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const countBy = (stage: string) =>
    merged.filter((c) => c.stage === stage).length;

  const guidanceCases = [
    ...profileRows.filter(
      (c) => !c.consultReviewer || c.consultReviewer === "guidance_counselor"
    ),
    ...earlyRows,
  ];

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayMs = 86_400_000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * dayMs);
  const referralTrend = Array.from({ length: 12 }, (_, i) => {
    const weekStart = new Date(thisMonday.getTime() - (11 - i) * 7 * dayMs);
    const weekEnd = new Date(weekStart.getTime() + 7 * dayMs);
    return {
      week: weekStart.toISOString().slice(0, 10),
      label: `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()}`,
      count: guidanceCases.filter((c) => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c.date);
        if (!m) return false;
        const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
        return at >= weekStart.getTime() && at < weekEnd.getTime();
      }).length,
    };
  });
  const summary = {
    total: merged.length,
    consultation: countBy("consultation"),
    meetingParents: countBy("meeting_parents"),
    homeVisitation: countBy("home_visitation"),
    certification: countBy("certification"),
    principalApproval: countBy("principal_approval"),
    needsHomeVisit: merged.filter(
      (c) => c.meetingAttended === false && !c.hasHomeVisit
    ).length,
    awaitingReview: earlyRows.filter((c) => !c.reviewed).length,
    reviewed: earlyRows.filter((c) => c.reviewed).length,

    scopedTotal: guidanceCases.length,
    referralTrend,

    byAction: [
      {
        action: "needs_review",
        label: "Needs review",
        count: earlyRows.filter((c) => !c.reviewed).length,
      },
      {
        action: "booked_session",
        label: "Booked session",
        count: earlyRows.filter((c) => c.reviewed && c.hasBookedSession).length,
      },
      {
        action: "followup",
        label: "Follow-up",
        count: earlyRows.filter(
          (c) => c.reviewed && !c.hasBookedSession && c.referralStatus === "follow_up"
        ).length,
      },
      {
        action: "endorsed",
        label: "Endorsed",
        count: earlyRows.filter(
          (c) => c.reviewed && !c.hasBookedSession && c.referralStatus === "in_progress"
        ).length,
      },
      {
        action: "rejected",
        label: "Rejected",
        count: earlyRows.filter((c) => c.referralStatus === "dismissed").length,
      },
    ],
  };

  const filtered = merged.filter((c) => {
    if (stageFilter && c.stage !== stageFilter) return false;
    if (
      q &&
      !`${c.student} ${c.lrn} ${c.section} ${c.reason} ${c.referredBy}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const cases = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const consultationQueue = consultationReferrals.map((r) => ({
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

  const unfilteredTotal = merged.length;
  return {
    summary: {
      ...summary,
      consultationAction: consultationQueue.length,
    },
    counselorName: counselor?.fullName ?? "Guidance Counselor",
    consultationQueue,

    reviewQueue: earlyRows.slice(0, 3),
    cases,
    page: safePage,
    pageSize,
    total,
    totalPages,
    unfilteredTotal,
  };
}
