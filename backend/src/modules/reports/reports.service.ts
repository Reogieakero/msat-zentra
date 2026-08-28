import { prisma } from "../../lib/prisma.js";
import {
  computeRiskFactors,
  levelFromFlags,
} from "../../services/risk.js";
import { classifyHonorRoll } from "../../services/grading.js";

const GRADE_LABELS: Record<string, string> = {
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
  G10: "Grade 10",
  G11: "Grade 11",
  G12: "Grade 12",
};

function gradeLabel(gradeLevel: string): string {
  return GRADE_LABELS[gradeLevel] ?? gradeLevel;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type ReportScope = "school" | "grade" | "section";

export interface ReportKpis {
  avgTransmuted: number;
  interventionsResolved: number;
  interventionRate: number;
  sectionsAtRisk: number;
  honorRoll: number;
}

export interface ReportsPayload {
  termLabel: string;
  schoolYear: string;
  kpis: ReportKpis;
  trends: { term: string; avgTransmuted: number }[];
  interventionSuccess: {
    grade: string;
    referred: number;
    resolved: number;
    ongoing: number;
    unresolved: number;
  }[];
  honorRollByGrade: { grade: string; candidates: number }[];
  admStages: { stage: string; count: number }[];
  admEligibility: { status: string; count: number }[];
  riskDistribution: { level: string; count: number }[];
  attendanceWatch: { section: string; rate: number }[];
  auditActivity: { action: string; count: number }[];
  anecdotalCategories: { category: string; count: number }[];
  accountApprovals: { band: string; pending: number }[];
}

// The 8 ADM pipeline stages, in canonical order, with the human label used by
// the Principal Reports command center (mirrors services/adm.ts ADM_STAGE_FLOW).
const ADM_STAGE_LABELS: Record<string, string> = {
  anecdotal: "Anecdotal",
  consultation: "Consultation",
  meeting_parents: "Meeting",
  home_visitation: "Home Visit",
  certification: "Certification",
  principal_approval: "Principal Sign",
  enrollment_monitoring: "Monitoring",
  completion: "Completed",
};

const ADM_STAGE_ORDER = [
  "anecdotal",
  "consultation",
  "meeting_parents",
  "home_visitation",
  "certification",
  "principal_approval",
  "enrollment_monitoring",
  "completion",
];

async function resolveScopeFilter(scope: ReportScope, opts: {
  gradeLevel?: string;
  sectionId?: string;
  termId: string | null;
  schoolYearId: string | null;
}) {
  const { gradeLevel, sectionId, termId, schoolYearId } = opts;
  // Returns prisma filters for section/student lookups scoped to the request.
  const sectionWhere: Record<string, unknown> = {};
  const studentWhere: Record<string, unknown> = {};
  if (scope === "section" && sectionId) {
    sectionWhere.id = sectionId;
    studentWhere.sectionId = sectionId;
  } else if (scope === "grade" && gradeLevel) {
    sectionWhere.gradeLevel = gradeLevel;
    studentWhere.gradeLevel = gradeLevel;
  } else if (schoolYearId) {
    sectionWhere.schoolYearId = schoolYearId;
  }
  return { sectionWhere, studentWhere };
}

export async function getReports(params: {
  scope: ReportScope;
  gradeLevel?: string;
  sectionId?: string;
}): Promise<ReportsPayload> {
  const activeTerm = await prisma.term.findFirst({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select: {
      id: true,
      termNumber: true,
      schoolYear: { select: { name: true, id: true } },
    },
  });
  const termId = activeTerm?.id ?? null;
  const schoolYearId = activeTerm?.schoolYear.id ?? null;
  const termLabel = activeTerm ? `Term ${activeTerm.termNumber}` : "No active term";
  const schoolYear = activeTerm?.schoolYear.name ?? "No active school year";

  const { sectionWhere, studentWhere } = await resolveScopeFilter(params.scope, {
    gradeLevel: params.gradeLevel,
    sectionId: params.sectionId,
    termId,
    schoolYearId,
  });

  // ---- Performance trends: avg transmuted per term (school-wide or scoped) ----
  const trends = await buildTrends(params.scope, {
    gradeLevel: params.gradeLevel,
    sectionId: params.sectionId,
    schoolYearId,
  });

  // ---- Scorecard sections, students, interventions, adm, audit, anecdotals ----
  const [sections, interventions, admProfiles, auditLogs, anecdotalRecords] =
    await Promise.all([
      prisma.section.findMany({
        where: sectionWhere,
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          students: {
            where: studentWhere,
            select: {
              userId: true,
              finalGrades: {
                where: termId ? { termId } : undefined,
                select: { transmutedGrade: true, computedAverage: true, lockStatus: true, finalizedAt: true },
              },
              attendanceRecords: { where: termId ? { termId } : undefined, select: { status: true } },
              anecdotalRecords: { where: termId ? { termId } : undefined, select: { id: true } },
            },
          },
        },
      }),
      prisma.intervention.findMany({
        where: termId ? { referral: { termId } } : undefined,
        select: { outcomeStatus: true, student: { select: { gradeLevel: true, sectionId: true } } },
      }),
      prisma.admLearnerProfile.findMany({
        where: termId ? { termId } : undefined,
        select: { stage: true, eligibilityStatus: true },
      }),
      prisma.auditLog.findMany({ select: { actionType: true } }),
      prisma.anecdotalRecord.findMany({
        where: { ...(termId ? { termId } : {}), ...anecdotalScopeWhere(params, sectionWhere) },
        select: { category: true },
      }),
    ]);

  // ---- KPIs + honor roll + risk distribution (live recompute) ----
  let transmutedSum = 0;
  let transmutedCount = 0;
  let honorRoll = 0;
  const riskCounts = { High: 0, Moderate: 0, Low: 0 };
  const honorRollByGradeMap = new Map<string, number>();

  for (const section of sections) {
    const grade = gradeLabel(section.gradeLevel);
    for (const student of section.students) {
      const finals = (student.finalGrades ?? []).filter(
        (f) => f.transmutedGrade != null && f.computedAverage != null
      );
      if (finals.length > 0) {
        const avg = round1(
          finals.reduce((a, f) => a + (f.transmutedGrade as number), 0) / finals.length
        );
        transmutedSum += avg;
        transmutedCount += 1;
      }
      const level = levelFromFlags(
        computeRiskFactors({
          finalGrades: student.finalGrades,
          attendance: student.attendanceRecords,
          anecdotalCount: student.anecdotalRecords.length,
          enrolled: section.students.length,
        })
      );
      riskCounts[level] += 1;
      // Honor roll uses the SAME DepEd rule as Academics/Overview: every subject
      // grade must be locked/finalized, the student must not be High risk, AND
      // the average must meet a DepEd honor band (classifyHonorRoll). Counting
      // any locked non-High student would overstate the figure vs those pages.
      const allLocked =
        finals.length > 0 &&
        finals.every((f) => f.lockStatus === "locked" || f.finalizedAt != null);
      if (allLocked && level !== "High") {
        const gGrades = finals.map((f) => f.transmutedGrade as number);
        const avg = gGrades.reduce((s, g) => s + g, 0) / gGrades.length;
        const lowest = gGrades.length > 0 ? Math.min(...gGrades) : 100;
        if (classifyHonorRoll(avg, lowest)) {
          honorRoll += 1;
          honorRollByGradeMap.set(grade, (honorRollByGradeMap.get(grade) ?? 0) + 1);
        }
      }
    }
  }

  const avgTransmuted = transmutedCount > 0 ? round1(transmutedSum / transmutedCount) : 0;
  const interventionsResolved = interventions.filter((i) => i.outcomeStatus === "resolved").length;
  const interventionsTotal = interventions.length;
  const interventionRate = interventionsTotal > 0 ? Math.round((interventionsResolved / interventionsTotal) * 100) : 0;

  // Sections at risk: a section counts when its live attendance rate < 80%.
  const sectionsAtRisk = await countSectionsAtRisk(params.scope, {
    gradeLevel: params.gradeLevel,
    sectionId: params.sectionId,
    termId,
    schoolYearId,
  });

  const kpis: ReportKpis = {
    avgTransmuted,
    interventionsResolved,
    interventionRate,
    sectionsAtRisk,
    honorRoll,
  };

  // ---- Intervention success by grade/section group ----
  const interventionSuccess = buildInterventionSuccess(params, sections, interventions);

  // ---- Honor roll by grade ----
  const honorRollByGrade = Array.from(honorRollByGradeMap.entries())
    .map(([grade, candidates]) => ({ grade, candidates }))
    .sort(
      (a, b) =>
        Number(a.grade.replace(/\D/g, "")) - Number(b.grade.replace(/\D/g, ""))
    );

  // ---- ADM pipeline + eligibility ----
  const admStages = ADM_STAGE_ORDER.map((stage) => ({
    stage: ADM_STAGE_LABELS[stage],
    count: admProfiles.filter((p) => p.stage === stage).length,
  }));
  const admEligibility = [
    { status: "Eligible", count: admProfiles.filter((p) => p.eligibilityStatus === "eligible").length },
    { status: "Pending", count: admProfiles.filter((p) => p.eligibilityStatus === "pending").length },
    { status: "Ineligible", count: admProfiles.filter((p) => p.eligibilityStatus === "ineligible").length },
  ];

  // ---- Risk distribution ----
  const riskDistribution = [
    { level: "High", count: riskCounts.High },
    { level: "Moderate", count: riskCounts.Moderate },
    { level: "Low", count: riskCounts.Low },
  ];

  // ---- Attendance watch: sections below 80% ----
  const attendanceWatch = await buildAttendanceWatch(params.scope, {
    gradeLevel: params.gradeLevel,
    sectionId: params.sectionId,
    termId,
    schoolYearId,
  });

  // ---- Audit activity by action type ----
  const auditActivity = buildAuditActivity(auditLogs);

  // ---- Anecdotal volume by category ----
  const anecdotalCategories = buildAnecdotalCategories(anecdotalRecords);

  // ---- Account approvals awaiting (RK / Registrar) ----
  const accountApprovals = await buildAccountApprovals();

  return {
    termLabel,
    schoolYear,
    kpis,
    trends,
    interventionSuccess,
    honorRollByGrade,
    admStages,
    admEligibility,
    riskDistribution,
    attendanceWatch,
    auditActivity,
    anecdotalCategories,
    accountApprovals,
  };
}

function anecdotalScopeWhere(
  params: { scope: ReportScope; gradeLevel?: string; sectionId?: string },
  sectionWhere: Record<string, unknown>
): Record<string, unknown> {
  // AnecdotalRecord has no gradeLevel field; scope it via section relationship.
  if (params.scope === "section" && params.sectionId) {
    return { sectionId: params.sectionId };
  }
  if (params.scope === "grade" && params.gradeLevel) {
    return { section: { gradeLevel: params.gradeLevel } };
  }
  if (sectionWhere.schoolYearId) {
    return { section: { schoolYearId: sectionWhere.schoolYearId } };
  }
  return {};
}

async function buildTrends(
  scope: ReportScope,
  opts: { gradeLevel?: string; sectionId?: string; schoolYearId: string | null }
): Promise<{ term: string; avgTransmuted: number }[]> {
  if (!opts.schoolYearId) return [];
  const terms = await prisma.term.findMany({
    where: { schoolYearId: opts.schoolYearId },
    orderBy: { termNumber: "asc" },
    select: { id: true, termNumber: true },
  });
  const sectionWhere: Record<string, unknown> = {};
  if (scope === "section" && opts.sectionId) sectionWhere.id = opts.sectionId;
  else if (scope === "grade" && opts.gradeLevel) sectionWhere.gradeLevel = opts.gradeLevel;
  else sectionWhere.schoolYearId = opts.schoolYearId;

  const result: { term: string; avgTransmuted: number }[] = [];
  for (const t of terms) {
    const sections = await prisma.section.findMany({
      where: sectionWhere,
      select: {
        id: true,
        students: {
          select: {
            finalGrades: {
              where: { termId: t.id },
              select: { transmutedGrade: true },
            },
          },
        },
      },
    });
    let sum = 0;
    let count = 0;
    for (const s of sections) {
      for (const st of s.students) {
        for (const g of st.finalGrades) {
          if (g.transmutedGrade != null) {
            sum += g.transmutedGrade as number;
            count += 1;
          }
        }
      }
    }
    const avg = count > 0 ? round1(sum / count) : 0;
    result.push({ term: `T${t.termNumber}`, avgTransmuted: avg });
  }
  return result;
}

function buildInterventionSuccess(
  params: { scope: ReportScope },
  sections: { id: string; gradeLevel: string; name: string }[],
  interventions: { outcomeStatus: string; student: { gradeLevel: string; sectionId: string | null } | null }[]
): { grade: string; referred: number; resolved: number; ongoing: number; unresolved: number }[] {
  // Group interventions by the section/grade label appropriate to the scope.
  const groups = new Map<string, { referred: number; resolved: number; ongoing: number; unresolved: number }>();
  const labelFor = (gradeLevel: string, sectionId: string | null): string => {
    if (params.scope === "section") {
      const sec = sections.find((s) => s.id === sectionId);
      return sec ? `Grade ${sec.name}` : gradeLabel(gradeLevel);
    }
    return gradeLabel(gradeLevel);
  };
  for (const iv of interventions) {
    if (!iv.student) continue;
    const label = labelFor(iv.student.gradeLevel, iv.student.sectionId ?? "");
    const acc = groups.get(label) ?? { referred: 0, resolved: 0, ongoing: 0, unresolved: 0 };
    acc.referred += 1;
    if (iv.outcomeStatus === "resolved") acc.resolved += 1;
    else if (iv.outcomeStatus === "ongoing") acc.ongoing += 1;
    else acc.unresolved += 1;
    groups.set(label, acc);
  }
  return Array.from(groups.entries())
    .map(([grade, v]) => ({ grade, ...v }))
    .sort(
      (a, b) =>
        Number(a.grade.replace(/\D/g, "")) - Number(b.grade.replace(/\D/g, ""))
    );
}

async function countSectionsAtRisk(
  scope: ReportScope,
  opts: { gradeLevel?: string; sectionId?: string; termId: string | null; schoolYearId: string | null }
): Promise<number> {
  const where: Record<string, unknown> = {};
  if (scope === "section" && opts.sectionId) where.id = opts.sectionId;
  else if (scope === "grade" && opts.gradeLevel) where.gradeLevel = opts.gradeLevel;
  else if (opts.schoolYearId) where.schoolYearId = opts.schoolYearId;

  const sections = await prisma.section.findMany({
    where,
    select: {
      attendanceRecords: {
        where: opts.termId ? { termId: opts.termId } : undefined,
        select: { status: true },
      },
    },
  });
  return sections.filter((sec) => {
    const total = sec.attendanceRecords.length;
    const present = sec.attendanceRecords.filter((a) => a.status === "present").length;
    return total > 0 && present / total < 0.8;
  }).length;
}

async function buildAttendanceWatch(
  scope: ReportScope,
  opts: { gradeLevel?: string; sectionId?: string; termId: string | null; schoolYearId: string | null }
): Promise<{ section: string; rate: number }[]> {
  const where: Record<string, unknown> = {};
  if (scope === "section" && opts.sectionId) where.id = opts.sectionId;
  else if (scope === "grade" && opts.gradeLevel) where.gradeLevel = opts.gradeLevel;
  else if (opts.schoolYearId) where.schoolYearId = opts.schoolYearId;

  const sections = await prisma.section.findMany({
    where,
    select: {
      name: true,
      gradeLevel: true,
      attendanceRecords: {
        where: opts.termId ? { termId: opts.termId } : undefined,
        select: { status: true },
      },
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" } ],
  });
  return sections
    .map((s) => {
      const total = s.attendanceRecords.length;
      const present = s.attendanceRecords.filter((a) => a.status === "present").length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return { section: `Grade ${s.name}`, rate };
    })
    .filter((s) => s.rate > 0 && s.rate < 80)
    .sort((a, b) => a.rate - b.rate);
}

function buildAuditActivity(logs: { actionType: string }[]): { action: string; count: number }[] {
  const LABELS: Record<string, string> = {
    grade_lock: "Grade Lock",
    anecdotal_edit: "Anecdotal Edit",
    adm_edit: "ADM Edit",
    referral_status_change: "Referral",
    intervention_approval: "Intervention",
    account_approval: "Account Approve",
    sf10_update: "SF10 Update",
    health_record_edit: "Health Edit",
  };
  const counts = new Map<string, number>();
  for (const log of logs) {
    const label = LABELS[log.actionType] ?? log.actionType;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  // Preserve a stable, meaningful order matching the command center.
  const ORDER = [
    "Grade Lock",
    "Anecdotal Edit",
    "ADM Edit",
    "Referral",
    "Intervention",
    "Account Approve",
    "SF10 Update",
    "Health Edit",
  ];
  return ORDER.filter((a) => counts.has(a)).map((a) => ({ action: a, count: counts.get(a)! }));
}

function buildAnecdotalCategories(records: { category: string }[]): { category: string; count: number }[] {
  // Labels mirror backend AnecdotalCategory enum CATEGORY_META so the Reports
  // breakdown agrees with the Risk / Anecdotal pages (bullying -> "Bullying").
  const LABELS: Record<string, string> = {
    behavioral: "Behavioral",
    academic: "Academic",
    attendance: "Attendance",
    health: "Health",
    bullying: "Bullying",
  };
  const counts = new Map<string, number>();
  for (const r of records) {
    const label = LABELS[r.category] ?? r.category;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const ORDER = ["Behavioral", "Academic", "Attendance", "Bullying", "Health"];
  return ORDER.filter((c) => counts.has(c)).map((c) => ({ category: c, count: counts.get(c)! }));
}

async function buildAccountApprovals(): Promise<{ band: string; pending: number }[]> {
  // Pending accounts split by grade band ownership: G7–G10 = Record Keeper,
  // G11–G12 = Registrar. Approximated from each pending user's student profile.
  const pendingUsers = await prisma.user.findMany({
    where: { status: "pending" },
    select: { studentProfile: { select: { gradeLevel: true } } },
  });
  let rk = 0;
  let registrar = 0;
  for (const u of pendingUsers) {
    const gl = u.studentProfile?.gradeLevel;
    if (gl === "G11" || gl === "G12") registrar += 1;
    else rk += 1;
  }
  return [
    { band: "Grades 7–10 (RK)", pending: rk },
    { band: "Grades 11–12 (Registrar)", pending: registrar },
  ];
}
