import { prisma } from "../../lib/prisma.js";
import { sectionHeadcounts } from "../enrollment.js";
import {
  computeRiskFactors,
  isAtRisk,
  levelFromFlags,
} from "../risk.js";
import {
  ADM_LABEL,
  GRADE_LABELS,
  GRADE_ORDER,
} from "../../modules/guidance/guidance.repository.js";
import type { GuidanceContext } from "./guidance.types.js";

export async function getOverview(ctx: GuidanceContext) {
  const counselorId = ctx.userId;
  const schoolYearId = ctx.schoolYearId;
  const termId = ctx.termId;

  const [counselor, term] = await Promise.all([
    prisma.user.findUnique({
      where: { id: counselorId },
      select: { fullName: true },
    }),
    termId
      ? prisma.term.findUnique({
          where: { id: termId },
          select: { termNumber: true, schoolYear: { select: { name: true } } },
        })
      : null,
  ]);
  const termLabel = term
    ? `${term.schoolYear.name.split(" ")[0]} · Term ${term.termNumber}`
    : "No active term";

  const [
    pendingAdm,
    pendingCounseling,
    endorsedHandoffs,
    referralsLatest,
    interventionsOpen,
    interventionsMine,
    interventionsLatest,
    guidanceReferralsDetailed,
    admLatest,
    admEarlyDetailed,
    students,
    rosterCohort,
    sectionPopulations,
  ] = await Promise.all([

    prisma.referral.count({
      where: {
        status: "pending",
        ...(termId ? { termId } : {}),
        OR: [
          { referredToRole: "guidance_counselor", escalatedTo: "adm_coordinator" },
          {
            referredToRole: "adm_coordinator",
            OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
          },
        ],
      },
    }),
    prisma.referral.count({
      where: {
        status: "pending",
        referredToRole: "guidance_counselor",
        ...(termId ? { termId } : {}),

        OR: [{ escalatedTo: null }, { NOT: { escalatedTo: "adm_coordinator" } }],
      },
    }),

    prisma.referral.count({
      where: {
        status: "in_progress",
        ...(termId ? { termId } : {}),
        OR: [
          { referredToRole: "guidance_counselor", escalatedTo: "adm_coordinator" },
          {
            referredToRole: "adm_coordinator",
            OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
          },
        ],
      },
    }),
    prisma.referral.findMany({
      where: {
        referredToRole: "guidance_counselor",
        ...(termId ? { termId } : {}),
      },

      orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
      take: 5,
      select: {
        id: true,
        reason: true,
        status: true,
        referredByUser: { select: { fullName: true } },
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
        anecdotalRecord: { select: { category: true, observationDatetime: true } },
      },
    }),
    prisma.intervention.count({
      where: {
        outcomeStatus: "ongoing",
        ...(termId ? { termId } : {}),
      },
    }),
    prisma.intervention.count({
      where: {
        assignedTo: counselorId,
        outcomeStatus: "ongoing",
        ...(termId ? { termId } : {}),
      },
    }),
    prisma.intervention.findMany({
      where: {
        outcomeStatus: "ongoing",
        ...(termId ? { termId } : {}),
      },
      orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        recommendedAction: true,
        approvalStatus: true,
        outcomeStatus: true,
        riskLevelAtFlag: true,
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

    prisma.referral.findMany({
      where: {
        ...(termId ? { termId } : {}),
        OR: [
          { referredToRole: "guidance_counselor" },
          {
            referredToRole: "adm_coordinator",
            OR: [{ consultReviewer: null }, { consultReviewer: "guidance_counselor" }],
          },
        ],
      },
      orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
      take: 500,
      select: {
        id: true,
        reason: true,
        status: true,
        referredBy: true,
        referredToRole: true,
        escalatedTo: true,
        anecdotalRecord: {
          select: { category: true, observationDatetime: true },
        },
        referredByUser: { select: { fullName: true } },
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
    prisma.admLearnerProfile.findMany({
      where: termId ? { termId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        stage: true,
        eligibilityStatus: true,
        createdAt: true,
        student: {
          select: {
            lrn: true,
            gradeLevel: true,
            user: { select: { fullName: true } },
          },
        },
      },
    }),

    prisma.referral.findMany({
      where: {
        referredToRole: "adm_coordinator",
        status: { in: ["pending", "in_progress"] },
        admProfiles: { none: {} },
        ...(termId ? { termId } : {}),
      },
      orderBy: { anecdotalRecord: { observationDatetime: "desc" } },
      take: 5,
      select: {
        id: true,
        reason: true,
        status: true,
        referredByUser: { select: { fullName: true } },
        anecdotalRecord: { select: { observationDatetime: true } },
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
      },
    }),
    prisma.studentProfile.findMany({
      where: schoolYearId ? { section: { schoolYearId } } : undefined,
      select: {
        lrn: true,
        gradeLevel: true,
        section: {
          select: { id: true, name: true, _count: { select: { students: true } } },
        },
        finalGrades: {
          where: termId ? { termId } : undefined,
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: {
          where: termId ? { termId } : undefined,
          select: { status: true },
        },
        anecdotalRecords: {
          where: termId ? { termId } : undefined,
          select: { id: true },
        },
      },
    }),
    prisma.studentRoster.findMany({
      where: schoolYearId ? { schoolYearId } : undefined,
      select: {
        lrn: true,
        gradeLevel: true,
        sectionId: true,
        finalGrades: {
          where: termId ? { termId } : undefined,
          select: { computedAverage: true, transmutedGrade: true },
        },
        attendanceRecords: {
          where: termId ? { termId } : undefined,
          select: { status: true },
        },
        anecdotalRecords: {
          where: termId ? { termId } : undefined,
          select: { id: true },
        },
      },
    }),
    prisma.section.findMany({
      where: schoolYearId ? { schoolYearId } : undefined,
      select: { id: true, name: true, gradeLevel: true, _count: { select: { students: true } } },
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
    }),
  ]);

  const headcounts = await sectionHeadcounts(sectionPopulations.map((s) => s.id));

  const registeredLrns = new Set(students.map((s) => s.lrn));
  const riskCohort: {
    gradeLevel: string;
    sectionId: string;
    enrolledFallback: number;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
    attendanceRecords: { status: string }[];
    anecdotalCount: number;
  }[] = [
    ...students.map((s) => ({
      gradeLevel: s.gradeLevel,
      sectionId: s.section?.id ?? "",
      enrolledFallback: s.section?._count.students ?? 0,
      finalGrades: s.finalGrades,
      attendanceRecords: s.attendanceRecords,
      anecdotalCount: s.anecdotalRecords.length,
    })),
    ...rosterCohort
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({
        gradeLevel: r.gradeLevel,
        sectionId: r.sectionId,
        enrolledFallback: 0,
        finalGrades: r.finalGrades,
        attendanceRecords: r.attendanceRecords,
        anecdotalCount: r.anecdotalRecords.length,
      })),
  ];

  let attendance = 0;
  let grades = 0;
  let behavior = 0;
  let high = 0;
  let moderate = 0;
  let low = 0;
  const riskByGrade = new Map<string, number>();
  const highByGrade = new Map<string, number>();
  const atRiskBySection = new Map<string, number>();
  const levelBySection = new Map<string, { high: number; moderate: number; low: number }>();

  for (const s of riskCohort) {
    const flags = computeRiskFactors({
      finalGrades: s.finalGrades,
      attendance: s.attendanceRecords,
      anecdotalCount: s.anecdotalCount,
      enrolled: headcounts.get(s.sectionId) ?? s.enrolledFallback,
    });
    if (flags.attendanceFlag) attendance++;
    if (flags.academicFlag) grades++;
    if (flags.behavioralFlag) behavior++;
    const level = levelFromFlags(flags);
    if (level === "High") high++;
    else if (level === "Moderate") moderate++;
    else low++;

    const bucket = levelBySection.get(s.sectionId) ?? { high: 0, moderate: 0, low: 0 };
    if (level === "High") bucket.high++;
    else if (level === "Moderate") bucket.moderate++;
    else bucket.low++;
    levelBySection.set(s.sectionId, bucket);

    if (isAtRisk(level)) {
      riskByGrade.set(s.gradeLevel, (riskByGrade.get(s.gradeLevel) ?? 0) + 1);
      atRiskBySection.set(s.sectionId, (atRiskBySection.get(s.sectionId) ?? 0) + 1);
    }
    if (level === "High") {
      highByGrade.set(s.gradeLevel, (highByGrade.get(s.gradeLevel) ?? 0) + 1);
    }
  }

  const riskByGradeRows = GRADE_ORDER.map((g) => ({
    grade: GRADE_LABELS[g],
    short: g,
    count: riskByGrade.get(g) ?? 0,
  }));

  const sectionsByGrade = new Map<string, typeof sectionPopulations>();
  for (const s of sectionPopulations) {
    const arr = sectionsByGrade.get(s.gradeLevel) ?? [];
    arr.push(s);
    sectionsByGrade.set(s.gradeLevel, arr);
  }

  const gradeAttention = GRADE_ORDER.map((g) => {
    const secs = sectionsByGrade.get(g) ?? [];
    let topSection = "—";
    let topCount = 0;
    let moderate = 0;
    let low = 0;

    const sectionsList: { name: string; atRisk: number }[] = [];
    for (const sec of secs) {
      const bucket = levelBySection.get(sec.id) ?? { high: 0, moderate: 0, low: 0 };
      moderate += bucket.moderate;
      low += bucket.low;
      const c = bucket.high + bucket.moderate;
      if (c > topCount) {
        topCount = c;
        topSection = sec.name;
      }
      sectionsList.push({ name: sec.name, atRisk: c });
    }
    sectionsList.sort((a, b) => b.atRisk - a.atRisk);
    const high = highByGrade.get(g) ?? 0;
    const atRisk = riskByGrade.get(g) ?? 0;

    const mostLevel =
      atRisk === 0
        ? null
        : high >= moderate && high >= low
          ? "High"
          : moderate >= low
            ? "Moderate"
            : "Low";
    return {
      grade: GRADE_LABELS[g],
      short: g,
      sections: secs.length,
      high,
      moderate,
      low,
      atRisk,
      mostLevel,
      topSection,
      topCount,
      sectionsList,
    };
  });

  const sectionHeat = sectionPopulations.map((s) => {
    const bucket = levelBySection.get(s.id) ?? { high: 0, moderate: 0, low: 0 };
    return {
      section: s.name,
      grade: GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel,
      ...bucket,
      total: bucket.high + bucket.moderate + bucket.low,
    };
  });

  let admCases = 0;
  let counselingCases = 0;
  for (const r of guidanceReferralsDetailed) {
    if (r.escalatedTo === "adm_coordinator" || r.referredToRole === "adm_coordinator") {
      admCases++;
    } else {
      counselingCases++;
    }
  }
  const referralsByType = [
    { type: "ADM", count: admCases },
    { type: "Counseling", count: counselingCases },
  ];

  const referralsQueue = referralsLatest.map((r) => ({
    id: r.id,
    student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
    grade: GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
    category: r.anecdotalRecord.category,
    referredBy: r.referredByUser?.fullName ?? "Adviser",
    reason: r.reason,
    status: r.status,
    date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
  }));

  const interventionsQueue = interventionsLatest.map((iv) => ({
    id: iv.id,
    student: iv.student?.user.fullName ?? iv.roster?.fullName ?? "Unknown student",
    lrn: iv.student?.lrn ?? iv.roster?.lrn ?? "",
    section: iv.student?.section?.name ?? iv.roster?.section?.name ?? "—",
    action: iv.recommendedAction,
    level: iv.riskLevelAtFlag,
    approval: iv.approvalStatus,
    outcome: iv.outcomeStatus,
  }));

  const latestAlerts = guidanceReferralsDetailed.slice(0, 5).map((r) => ({
    id: r.id,
    student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    section: r.student?.section?.name ?? r.roster?.section?.name ?? "—",
    category: r.anecdotalRecord.category,
    referredBy: r.referredByUser?.fullName ?? "Adviser",
    reason: r.reason,
    status: r.status,
    date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
  }));

  const admProfileRows = admLatest.map((p) => ({
    id: p.id,
    student: p.student.user.fullName,
    lrn: p.student.lrn,
    grade: GRADE_LABELS[p.student.gradeLevel] ?? p.student.gradeLevel,
    stage: p.stage,
    stageLabel: ADM_LABEL.get(p.stage) ?? p.stage,
    eligibility: p.eligibilityStatus,
    date: p.createdAt.toISOString().slice(0, 10),
  }));
  const admEarlyRows = admEarlyDetailed.map((r) => ({
    id: `referral:${r.id}`,
    student: r.student?.user.fullName ?? r.roster?.fullName ?? "Unknown student",
    lrn: r.student?.lrn ?? r.roster?.lrn ?? "",
    grade: GRADE_LABELS[r.student?.gradeLevel ?? r.roster?.gradeLevel ?? ""] ?? "",
    stage: "consultation",
    stageLabel: ADM_LABEL.get("consultation") ?? "Consultation and referral",
    eligibility: "pending",
    date: r.anecdotalRecord.observationDatetime.toISOString().slice(0, 10),
  }));
  const admQueue = [...admProfileRows, ...admEarlyRows]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return {
    counselorName: counselor?.fullName ?? "Guidance Counselor",
    termLabel,
    kpis: {
      referredToMe: pendingAdm + pendingCounseling,
      pendingAdm,
      pendingCounseling,
      openInterventions: interventionsOpen,
      myInterventions: interventionsMine,
      highRisk: high,
      admHandoffs: endorsedHandoffs,
    },
    riskByLevel: { high, moderate, low },
    factorTotals: { attendance, grades, behavior },
    riskByGrade: riskByGradeRows,
    gradeAttention,
    sectionHeat,
    referralsByType,
    referralsQueue,
    interventionsQueue,
    latestAlerts,
    admQueue,
  };
}
