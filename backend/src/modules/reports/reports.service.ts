import { prisma } from "../../lib/prisma.js";
import type { GradeLevel } from "../../generated/prisma/client.js";
import { meetsAcademicExcellenceAward } from "../../services/grading.js";

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

// Numeric grade level from a "Grade <name>" label, for stable G7→G12 ordering.
function gradeNum(label: string): number {
  const m = label.match(/\d+/);
  return m ? Number(m[0]) : 0;
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
  schoolYearId?: string | null;
  termId?: string | null;
}): Promise<ReportsPayload> {
  // Session's active term first; legacy active-year lookup only when the
  // request carries no scope.
  let activeTerm: {
    id: string;
    termNumber: number;
    schoolYear: { name: string; id: string };
  } | null = null;
  if (params.termId) {
    activeTerm = await prisma.term.findUnique({
      where: { id: params.termId },
      select: { id: true, termNumber: true, schoolYear: { select: { name: true, id: true } } },
    });
  }
  if (!activeTerm && params.schoolYearId) {
    activeTerm = await prisma.term.findFirst({
      where: { schoolYearId: params.schoolYearId },
      orderBy: { termNumber: "asc" },
      select: { id: true, termNumber: true, schoolYear: { select: { name: true, id: true } } },
    });
  }
  if (!activeTerm) {
    activeTerm = await prisma.term.findFirst({
      where: { schoolYear: { isActive: true } },
      orderBy: { termNumber: "asc" },
      select: {
        id: true,
        termNumber: true,
        schoolYear: { select: { name: true, id: true } },
      },
    });
  }
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
              lrn: true,
              finalGrades: {
                where: termId ? { termId } : undefined,
                select: { transmutedGrade: true, computedAverage: true, lockStatus: true, finalizedAt: true },
              },
              attendanceRecords: { where: termId ? { termId } : undefined, select: { status: true } },
              anecdotalRecords: { where: termId ? { termId } : undefined, select: { id: true } },
            },
          },
          // Enlisted students without accounts — same grade scope when set.
          rosterEntries: {
            where:
              typeof studentWhere.gradeLevel === "string"
                ? { gradeLevel: studentWhere.gradeLevel as GradeLevel }
                : undefined,
            select: {
              lrn: true,
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
        where: termId ? { termId } : undefined,
        select: { outcomeStatus: true, student: { select: { gradeLevel: true, sectionId: true } } },
      }),
      prisma.admLearnerProfile.findMany({
        where: termId ? { termId } : undefined,
        select: { stage: true, eligibilityStatus: true },
      }),
      // Bounded to recent rows instead of the entire audit table
      // (audit has no term FK; activity panel only needs recent volume).
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 2000,
        select: { actionType: true },
      }),
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
    // Registered profiles plus unregistered enlistments (matched by LRN).
    const registeredLrns = new Set(section.students.map((s) => s.lrn));
    const cohort = [
      ...section.students,
      ...section.rosterEntries
        .filter((r) => !registeredLrns.has(r.lrn))
        .map((r) => ({ userId: "", ...r })),
    ];
    for (const student of cohort) {
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
      // Risk level uses the SAME rule as the Risk board (riskBoard.service):
      // academic flag from transmuted grades (gradeMode "final"), attendance flag
      // from present / totalRecords for THIS student (not section enrollment),
      // behavioral from any anecdotal. Keeps the two cards in sync.
      const studentFinals = (student.finalGrades ?? []).filter(
        (f) => f.transmutedGrade != null
      );
      const sAvg =
        studentFinals.length > 0
          ? studentFinals.reduce((sum, g) => sum + (g.transmutedGrade as number), 0) /
            studentFinals.length
          : 100;
      const aFlag = sAvg < 75;
      const sPresent = (student.attendanceRecords ?? []).filter(
        (a) => a.status === "present"
      ).length;
      const sTotal = (student.attendanceRecords ?? []).length;
      const tFlag = sTotal > 0 && sPresent / sTotal < 0.8;
      const bFlag = (student.anecdotalRecords ?? []).length > 0;
      const sCount = (aFlag ? 1 : 0) + (tFlag ? 1 : 0) + (bFlag ? 1 : 0);
      const level: "High" | "Moderate" | "Low" =
        sCount >= 2 ? "High" : sCount === 1 ? "Moderate" : "Low";
      riskCounts[level] += 1;
      // Honor roll uses the SAME DepEd rule as Academics/Overview: every subject
      // grade must be locked/finalized, the student must not be High risk, AND
      // the average must meet the Academic Excellence rule (DO 15, s. 2026).
      // Counting any locked non-High student would overstate the figure vs
      // those pages.
      const allLocked =
        finals.length > 0 &&
        finals.every(
          (f) =>
            f.lockStatus === "locked" ||
            f.lockStatus === "adviser_approved" ||
            f.finalizedAt != null
        );
      if (allLocked && level !== "High") {
        const gGrades = finals.map((f) => f.transmutedGrade as number);
        const avg = gGrades.reduce((s, g) => s + g, 0) / gGrades.length;
        const lowest = gGrades.length > 0 ? Math.min(...gGrades) : 100;
        if (meetsAcademicExcellenceAward(avg, lowest)) {
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

  // Sections at risk + attendance watch share ONE section-attendance fetch
  // (was two identical findMany passes). Computed together below.
  const attendanceScope = {
    gradeLevel: params.gradeLevel,
    sectionId: params.sectionId,
    termId,
    schoolYearId,
  };
  const { sectionsAtRisk, attendanceWatch } = await buildAttendanceSectionStats(
    params.scope,
    attendanceScope,
  );

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

  // Parallel per-term fetch (was serial await-in-loop). Terms are few (3),
  // so Promise.all is bounded and safe.
  const perTerm = await Promise.all(
    terms.map(async (t) => {
      const sections = await prisma.section.findMany({
        where: sectionWhere,
        select: {
          id: true,
          students: {
            select: {
              lrn: true,
              finalGrades: {
                where: { termId: t.id },
                select: { transmutedGrade: true },
              },
            },
          },
          rosterEntries: {
            select: {
              lrn: true,
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
      const tally = (grades: { transmutedGrade: number | null }[]) => {
        for (const g of grades) {
          if (g.transmutedGrade != null) {
            sum += g.transmutedGrade as number;
            count += 1;
          }
        }
      };
      for (const s of sections) {
        const registeredLrns = new Set(s.students.map((st) => st.lrn));
        for (const st of s.students) tally(st.finalGrades);
        for (const r of s.rosterEntries) {
          if (!registeredLrns.has(r.lrn)) tally(r.finalGrades);
        }
      }
      const avg = count > 0 ? round1(sum / count) : 0;
      return { term: `T${t.termNumber}`, avgTransmuted: avg, order: t.termNumber };
    }),
  );
  return perTerm
    .sort((a, b) => a.order - b.order)
    .map(({ term, avgTransmuted }) => ({ term, avgTransmuted }));
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

// Single section-attendance pass feeding BOTH the at-risk count and the
// watch list (previously two identical findMany queries).
async function buildAttendanceSectionStats(
  scope: ReportScope,
  opts: { gradeLevel?: string; sectionId?: string; termId: string | null; schoolYearId: string | null }
): Promise<{ sectionsAtRisk: number; attendanceWatch: { section: string; rate: number }[] }> {
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
  let sectionsAtRisk = 0;
  const watch: { section: string; rate: number }[] = [];
  for (const s of sections) {
    const total = s.attendanceRecords.length;
    const present = s.attendanceRecords.filter((a) => a.status === "present").length;
    if (total > 0 && present / total < 0.8) sectionsAtRisk += 1;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    if (rate > 0 && rate < 80) watch.push({ section: `Grade ${s.name}`, rate });
  }
  watch.sort((a, b) => gradeNum(a.section) - gradeNum(b.section) || a.rate - b.rate);
  return { sectionsAtRisk, attendanceWatch: watch };
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
