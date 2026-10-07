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
  type AdmStage,
} from "../../modules/guidance/guidance.repository.js";
import type { GuidanceContext } from "./guidance.types.js";

export interface AlertsQuery {
  level: "High" | "Moderate" | null;
  factor: "academic" | "attendance" | "behavioral" | null;
  q: string;
  page: number;
  pageSize: number;
}

// Guidance Counselor alerts: live system-flagged queue from the shared risk
// engine (academic < 75, attendance < 80%, >= 1 anecdotal this term).
// Status-only rows — student identity, level, tripped factors, referral and
// intervention state. No anecdotal write-up content ever leaves this endpoint:
// the behavioral trigger is a report COUNT, and full filings stay visible
// only after an adviser refers the case (see the referrals queue).
export async function getAlerts(ctx: GuidanceContext, query: AlertsQuery) {
  const { levelFilter, factorFilter, q, page, pageSize } = {
    levelFilter: query.level,
    factorFilter: query.factor,
    q: query.q,
    page: query.page,
    pageSize: query.pageSize,
  };
  const schoolYearId = ctx.schoolYearId;
  const termId = ctx.termId;
  const term = termId
    ? await prisma.term.findUnique({
        where: { id: termId },
        select: { termNumber: true, schoolYear: { select: { name: true } } },
      })
    : null;
  const termLabel = term
    ? `${term.schoolYear.name.split(" ")[0]} · Term ${term.termNumber}`
    : "No active term";

  const [students, rosterCohort, sectionPopulations, guidanceReferrals, interventions, admProfiles, admReferrals] =
    await Promise.all([
      prisma.studentProfile.findMany({
        where: schoolYearId ? { section: { schoolYearId } } : undefined,
        select: {
          userId: true,
          lrn: true,
          gradeLevel: true,
          section: { select: { id: true, name: true, _count: { select: { students: true } } } },
          user: { select: { fullName: true } },
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
          id: true,
          lrn: true,
          fullName: true,
          gradeLevel: true,
          sectionId: true,
          section: { select: { name: true } },
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
        select: { id: true },
      }),
      prisma.referral.findMany({
        where: {
          referredToRole: "guidance_counselor",
          ...(termId ? { termId } : {}),
        },
        select: { studentId: true, rosterId: true, status: true },
      }),
      prisma.intervention.findMany({
        where: termId ? { termId } : undefined,
        orderBy: { id: "desc" },
        take: 2000,
        select: { studentId: true, rosterId: true, outcomeStatus: true },
      }),
      // ADM track membership (status-only): a tracked learner profile or
      // an ADM-track referral marks the case ADM; everything else is the
      // general guidance caseload.
      prisma.admLearnerProfile.findMany({
        where: termId ? { termId } : undefined,
        select: { studentId: true, stage: true },
      }),
      prisma.referral.findMany({
        where: {
          referredToRole: "adm_coordinator",
          ...(termId ? { termId } : {}),
        },
        select: { studentId: true, rosterId: true },
      }),
    ]);

  const headcounts = await sectionHeadcounts(sectionPopulations.map((s) => s.id));

  // Latest referral / intervention state per student key.
  const referralByKey = new Map<string, string>();
  for (const r of guidanceReferrals) {
    const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
    if (key && !referralByKey.has(key)) referralByKey.set(key, r.status);
  }
  const interventionByKey = new Map<string, string>();
  for (const iv of interventions) {
    const key = iv.studentId ?? (iv.rosterId ? `roster:${iv.rosterId}` : null);
    if (key && !interventionByKey.has(key)) interventionByKey.set(key, iv.outcomeStatus);
  }
  // ADM stage per student key (tracked profile wins; otherwise any
  // ADM-track referral still marks the case ADM at consultation).
  const admStageByKey = new Map<string, string>();
  for (const p of admProfiles) {
    if (!admStageByKey.has(p.studentId)) admStageByKey.set(p.studentId, p.stage);
  }
  for (const r of admReferrals) {
    const key = r.studentId ?? (r.rosterId ? `roster:${r.rosterId}` : null);
    if (key && !admStageByKey.has(key)) admStageByKey.set(key, "consultation");
  }

  const registeredLrns = new Set(students.map((s) => s.lrn));
  const cohort: {
    key: string;
    student: string;
    lrn: string;
    gradeLevel: string;
    sectionId: string;
    section: string;
    enrolledFallback: number;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null }[];
    attendanceRecords: { status: string }[];
    anecdotalCount: number;
  }[] = [
    ...students.map((s) => ({
      key: s.userId,
      student: s.user.fullName,
      lrn: s.lrn,
      gradeLevel: s.gradeLevel,
      sectionId: s.section?.id ?? "",
      section: s.section?.name ?? "—",
      enrolledFallback: s.section?._count.students ?? 0,
      finalGrades: s.finalGrades,
      attendanceRecords: s.attendanceRecords,
      anecdotalCount: s.anecdotalRecords.length,
    })),
    ...rosterCohort
      .filter((r) => !registeredLrns.has(r.lrn))
      .map((r) => ({
        key: `roster:${r.id}`,
        student: r.fullName,
        lrn: r.lrn,
        gradeLevel: r.gradeLevel,
        sectionId: r.sectionId,
        section: r.section?.name ?? "—",
        enrolledFallback: 0,
        finalGrades: r.finalGrades,
        attendanceRecords: r.attendanceRecords,
        anecdotalCount: r.anecdotalRecords.length,
      })),
  ];

  const flagged = [];
  let academicTotal = 0;
  let attendanceTotal = 0;
  let behavioralTotal = 0;
  let referredTotal = 0;
  for (const s of cohort) {
    const flags = computeRiskFactors({
      finalGrades: s.finalGrades,
      attendance: s.attendanceRecords,
      anecdotalCount: s.anecdotalCount,
      enrolled: headcounts.get(s.sectionId) ?? s.enrolledFallback,
    });
    const level = levelFromFlags(flags);
    if (!isAtRisk(level)) continue;
    if (flags.academicFlag) academicTotal++;
    if (flags.attendanceFlag) attendanceTotal++;
    if (flags.behavioralFlag) behavioralTotal++;
    const referralStatus = referralByKey.get(s.key) ?? null;
    if (referralStatus) referredTotal++;
    const admStage = admStageByKey.get(s.key) ?? null;
    const triggers: string[] = [];
    if (flags.academicFlag) triggers.push("Academic average below 75");
    if (flags.attendanceFlag) triggers.push("Attendance below 80%");
    if (flags.behavioralFlag)
      triggers.push(
        `${s.anecdotalCount} behavioral report${s.anecdotalCount === 1 ? "" : "s"} filed`
      );
    flagged.push({
      id: s.key,
      student: s.student,
      lrn: s.lrn,
      section: s.section,
      grade: GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel,
      level,
      flagCount:
        (flags.academicFlag ? 1 : 0) +
        (flags.attendanceFlag ? 1 : 0) +
        (flags.behavioralFlag ? 1 : 0),
      factors: {
        academic: flags.academicFlag,
        attendance: flags.attendanceFlag,
        behavioral: flags.behavioralFlag,
      },
      triggers,
      anecdotalCount: s.anecdotalCount,
      referralStatus,
      interventionOutcome: interventionByKey.get(s.key) ?? null,
      track: admStage ? "adm" : "general",
      admStageLabel: admStage ? (ADM_LABEL.get(admStage as AdmStage) ?? admStage) : null,
    });
  }

  // High first, then most flags, then name — newest risk first.
  flagged.sort(
    (a, b) =>
      (a.level === "High" ? 0 : 1) - (b.level === "High" ? 0 : 1) ||
      b.flagCount - a.flagCount ||
      a.student.localeCompare(b.student)
  );

  const filtered = flagged.filter((a) => {
    if (levelFilter && a.level !== levelFilter) return false;
    if (factorFilter && !a.factors[factorFilter]) return false;
    if (
      q &&
      !`${a.student} ${a.lrn} ${a.section}`.toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const alerts = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Tile stats stay UNFILTERED so searching never shrinks the tiles;
  // `total` is the filtered pager count.
  const unfilteredTotal = flagged.length;
  return {
    termLabel,
    summary: {
      high: flagged.filter((a) => a.level === "High").length,
      moderate: flagged.filter((a) => a.level === "Moderate").length,
      total: unfilteredTotal,
      academic: academicTotal,
      attendance: attendanceTotal,
      behavioral: behavioralTotal,
      referred: referredTotal,
      unreferred: unfilteredTotal - referredTotal,
    },
    alerts,
    page: safePage,
    pageSize,
    total,
    totalPages,
    unfilteredTotal,
  };
}
