import { prisma } from "../../lib/prisma.js";
import { paginated, clampPage } from "../../lib/pagination.js";
import { adviserSectionsOr404 } from "../../modules/teacher/advisory.repository.js";
import type { AdvisoryContext } from "../../services/advisory/advisory.types.js";
import type {
  AdvisoryInterventionFactor,
  AdvisoryInterventionLevel,
  AdvisoryInterventionOutcome,
} from "../../modules/teacher/advisory-interventions.schemas.js";

export type ApprovalStatusValue = "pending" | "approved" | "rejected" | "modified";
export type OutcomeStatusValue = "ongoing" | "resolved" | "unresolved";

export interface AdvisoryInterventionSession {
  id: string;
  sessionType: string;
  scheduledAt: string;
  venue: string | null;
  status: string;
  sessionNotes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  createdAt: string;
  completedAt: string | null;
  attachmentsCount: number;
}

export interface AdvisoryIntervention {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  assignee: string | null;
  assignedAt: string | null;
  approvalStatus: ApprovalStatusValue;
  outcomeStatus: OutcomeStatusValue;
  outcomeNotes: string | null;
  priority: string | null;
  intakeNotes: string | null;
  sessions: AdvisoryInterventionSession[];
}

export interface AdvisoryInterventionRow {
  key: string;
  studentId: string | null;
  rosterId: string | null;
  name: string;
  lrn: string;
  mascot: string | null;
  sectionId: string;
  section: string;
  gradeLevel: string;
  riskLevel: string;
  riskCount: number;
  factors: {
    academic: boolean;
    attendance: boolean;
    behavioral: boolean;
  };
  /** Latest risk snapshot (fallback: intervention assignment date). */
  detectedAt: string | null;
  intervention: AdvisoryIntervention | null;
}

export interface AdvisoryInterventionsSummary {
  high: number;
  moderate: number;
  low: number;
  ongoing: number;
  resolved: number;
  unresolved: number;
  /** Flagged advisees guidance has not opened an intervention for yet. */
  noPlan: number;
  total: number;
}

export interface AdvisoryInterventionsQuery {
  page: number;
  pageSize: number;
  sectionId?: string;
  level?: AdvisoryInterventionLevel;
  factor?: AdvisoryInterventionFactor;
  outcome?: AdvisoryInterventionOutcome;
  q?: string;
}

const LEVEL_RANK: Record<string, number> = { High: 0, Moderate: 1, Low: 2 };

interface LearnerRef {
  key: string;
  studentId: string | null;
  rosterId: string | null;
  name: string;
  lrn: string;
  mascot: string | null;
  sectionId: string;
  section: string;
  gradeLevel: string;
  riskLevel: string;
  riskCount: number;
  factors: AdvisoryInterventionRow["factors"];
}

interface SectionInfo {
  id: string;
  name: string;
  gradeLevel: string;
}

interface TermRiskSnapshot {
  riskLevel: string;
  riskCount: number;
  factors: AdvisoryInterventionRow["factors"];
  snapshotDate: Date;
}

const iso = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

/**
 * Learners in the adviser's section(s). Roster rows whose LRN already has a
 * StudentProfile are dropped — same merge rule as the advisory list, so a
 * learner never appears twice.
 */
async function sectionLearners(sectionIds: string[]): Promise<LearnerRef[]> {
  const [profiles, rosters] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId: { in: sectionIds } },
      select: {
        userId: true,
        lrn: true,
        mascot: true,
        riskLevel: true,
        riskCount: true,
        academicFlag: true,
        attendanceFlag: true,
        behavioralFlag: true,
        section: { select: { id: true, name: true, gradeLevel: true } },
        user: { select: { fullName: true } },
      },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId: { in: sectionIds } },
      select: {
        id: true,
        lrn: true,
        fullName: true,
        mascot: true,
        riskLevel: true,
        riskCount: true,
        academicFlag: true,
        attendanceFlag: true,
        behavioralFlag: true,
        sectionId: true,
        section: { select: { id: true, name: true, gradeLevel: true } },
      },
    }),
  ]);

  const enrolledLrns = new Set(profiles.map((p) => p.lrn));
  return [
    ...profiles.map((p) => ({
      key: p.userId,
      studentId: p.userId,
      rosterId: null,
      name: p.user.fullName,
      lrn: p.lrn,
      mascot: p.mascot,
      sectionId: p.section?.id ?? "",
      section: p.section?.name ?? "—",
      gradeLevel: String(p.section?.gradeLevel ?? ""),
      riskLevel: String(p.riskLevel),
      riskCount: p.riskCount,
      factors: {
        academic: p.academicFlag,
        attendance: p.attendanceFlag,
        behavioral: p.behavioralFlag,
      },
    })),
    ...rosters
      .filter((r) => !enrolledLrns.has(r.lrn))
      .map((r) => ({
        key: `roster:${r.id}`,
        studentId: null,
        rosterId: r.id,
        name: r.fullName,
        lrn: r.lrn,
        mascot: r.mascot,
        sectionId: r.sectionId ?? r.section?.id ?? "",
        section: r.section?.name ?? "—",
        gradeLevel: String(r.section?.gradeLevel ?? ""),
        riskLevel: String(r.riskLevel),
        riskCount: r.riskCount,
        factors: {
          academic: r.academicFlag,
          attendance: r.attendanceFlag,
          behavioral: r.behavioralFlag,
        },
      })),
  ];
}

/** Latest intervention per learner key for the term (full session detail). */
async function interventionsByLearner(
  termId: string,
  profileIds: string[],
  rosterIds: string[],
): Promise<Map<string, AdvisoryIntervention>> {
  if (profileIds.length === 0 && rosterIds.length === 0) return new Map();

  const rows = await prisma.intervention.findMany({
    where: {
      termId,
      OR: [
        ...(profileIds.length ? [{ studentId: { in: profileIds } }] : []),
        ...(rosterIds.length ? [{ rosterId: { in: rosterIds } }] : []),
      ],
    },
    // The model has no createdAt; a descending id keeps the newest row first
    // so the first one seen per learner is the current plan.
    orderBy: { id: "desc" },
    select: {
      id: true,
      studentId: true,
      rosterId: true,
      recommendedAction: true,
      assignedTo: true,
      assignedAt: true,
      approvalStatus: true,
      outcomeStatus: true,
      outcomeNotes: true,
      priority: true,
      intakeNotes: true,
      assignee: { select: { fullName: true } },
      counselingSessions: {
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          sessionType: true,
          scheduledAt: true,
          venue: true,
          status: true,
          sessionNotes: true,
          outcome: true,
          cancelReason: true,
          createdAt: true,
          completedAt: true,
          attachments: { select: { id: true } },
        },
      },
    },
  });

  const byLearner = new Map<string, AdvisoryIntervention>();
  for (const row of rows) {
    const key = row.studentId ?? (row.rosterId ? `roster:${row.rosterId}` : null);
    if (!key || byLearner.has(key)) continue;
    byLearner.set(key, {
      id: row.id,
      recommendedAction: row.recommendedAction,
      assignedTo: row.assignedTo,
      assignee: row.assignee?.fullName ?? null,
      assignedAt: iso(row.assignedAt),
      approvalStatus: row.approvalStatus as ApprovalStatusValue,
      outcomeStatus: row.outcomeStatus as OutcomeStatusValue,
      outcomeNotes: row.outcomeNotes,
      priority: row.priority,
      intakeNotes: row.intakeNotes,
      sessions: row.counselingSessions.map((session) => ({
        id: session.id,
        sessionType: session.sessionType,
        scheduledAt: session.scheduledAt.toISOString(),
        venue: session.venue,
        status: session.status,
        sessionNotes: session.sessionNotes,
        outcome: session.outcome,
        cancelReason: session.cancelReason,
        createdAt: session.createdAt.toISOString(),
        completedAt: iso(session.completedAt),
        attachmentsCount: session.attachments.length,
      })),
    });
  }
  return byLearner;
}

/** Latest risk snapshot per learner key for the term, with its flags. */
async function termSnapshots(
  termId: string,
  profileIds: string[],
  rosterIds: string[],
): Promise<Map<string, TermRiskSnapshot>> {
  if (profileIds.length === 0 && rosterIds.length === 0) return new Map();

  const rows = await prisma.riskSnapshot.findMany({
    where: {
      termId,
      OR: [
        ...(profileIds.length ? [{ studentId: { in: profileIds } }] : []),
        ...(rosterIds.length ? [{ rosterId: { in: rosterIds } }] : []),
      ],
    },
    orderBy: { snapshotDate: "desc" },
    select: {
      studentId: true,
      rosterId: true,
      riskLevel: true,
      riskLevelFinal: true,
      riskCount: true,
      academicFlag: true,
      attendanceFlag: true,
      behavioralFlag: true,
      snapshotDate: true,
    },
  });

  const snapshots = new Map<string, TermRiskSnapshot>();
  for (const row of rows) {
    const key = row.studentId ?? (row.rosterId ? `roster:${row.rosterId}` : null);
    if (!key || snapshots.has(key)) continue;
    snapshots.set(key, {
      riskLevel: String(row.riskLevelFinal ?? row.riskLevel),
      riskCount: row.riskCount,
      factors: {
        academic: row.academicFlag ?? false,
        attendance: row.attendanceFlag ?? false,
        behavioral: row.behavioralFlag ?? false,
      },
      snapshotDate: row.snapshotDate,
    });
  }
  return snapshots;
}

export async function listAdvisoryInterventions(
  ctx: AdvisoryContext,
  query: AdvisoryInterventionsQuery,
) {
  const allSections = await adviserSectionsOr404(ctx.userId, ctx.schoolYearId);
  const sections: SectionInfo[] = allSections.map((section) => ({
    id: section.id,
    name: section.name,
    gradeLevel: String(section.gradeLevel),
  }));

  // The section filter is advisory: an unknown id falls back to every section
  // the teacher advises instead of leaking another section's learners.
  const sectionIds = query.sectionId
    ? sections.filter((section) => section.id === query.sectionId).map((s) => s.id)
    : sections.map((section) => section.id);

  const termId = ctx.termId;
  if (!termId || sectionIds.length === 0) {
    return {
      summary: emptySummary(),
      sections,
      ...paginated<AdvisoryInterventionRow>([], 0, query.page, query.pageSize),
    };
  }

  const learners = await sectionLearners(sectionIds);
  const profileIds = learners
    .map((learner) => learner.studentId)
    .filter((id): id is string => Boolean(id));
  const rosterIds = learners
    .map((learner) => learner.rosterId)
    .filter((id): id is string => Boolean(id));

  const [interventionByKey, snapshotByKey] = await Promise.all([
    interventionsByLearner(termId, profileIds, rosterIds),
    termSnapshots(termId, profileIds, rosterIds),
  ]);

  const allRows: AdvisoryInterventionRow[] = learners.map((learner) => {
    const intervention = interventionByKey.get(learner.key) ?? null;
    // Risk flags on the profile are live (current term only). The desk follows
    // the teacher's selected term, so its level/flags must come from that
    // term's snapshot — otherwise last term's flags leak onto this board.
    const snapshot = snapshotByKey.get(learner.key) ?? null;
    return {
      ...learner,
      riskLevel: snapshot?.riskLevel ?? "Low",
      riskCount: snapshot?.riskCount ?? 0,
      factors:
        snapshot?.factors ?? { academic: false, attendance: false, behavioral: false },
      detectedAt:
        iso(snapshot?.snapshotDate ?? null) ?? intervention?.assignedAt ?? null,
      intervention,
    };
  });

  // Monitoring desk, not a roster: only learners the risk engine flagged this
  // term (or guidance opened a plan for) belong here.
  const monitoredRows = allRows.filter(
    (row) =>
      row.intervention !== null ||
      row.factors.academic ||
      row.factors.attendance ||
      row.factors.behavioral,
  );

  const summary = summarize(monitoredRows);

  const needle = (query.q ?? "").trim().toLowerCase();
  const filtered = monitoredRows.filter((row) => {
    if (query.level && row.riskLevel !== query.level) return false;
    if (query.factor && !row.factors[query.factor]) return false;
    if (query.outcome === "none" && row.intervention) return false;
    if (
      query.outcome &&
      query.outcome !== "none" &&
      row.intervention?.outcomeStatus !== query.outcome
    )
      return false;
    if (
      needle &&
      !`${row.name} ${row.lrn} ${row.section}`.toLowerCase().includes(needle)
    )
      return false;
    return true;
  });

  filtered.sort(
    (a, b) =>
      (LEVEL_RANK[a.riskLevel] ?? 9) - (LEVEL_RANK[b.riskLevel] ?? 9) ||
      b.riskCount - a.riskCount ||
      a.name.localeCompare(b.name),
  );

  const safePage = clampPage(query.page, filtered.length, query.pageSize);
  const start = (safePage - 1) * query.pageSize;

  return {
    summary,
    sections,
    ...paginated(
      filtered.slice(start, start + query.pageSize),
      filtered.length,
      safePage,
      query.pageSize,
    ),
  };
}

function summarize(rows: AdvisoryInterventionRow[]): AdvisoryInterventionsSummary {
  return {
    high: rows.filter((row) => row.riskLevel === "High").length,
    moderate: rows.filter((row) => row.riskLevel === "Moderate").length,
    low: rows.filter((row) => row.riskLevel === "Low").length,
    ongoing: rows.filter((row) => row.intervention?.outcomeStatus === "ongoing").length,
    resolved: rows.filter((row) => row.intervention?.outcomeStatus === "resolved").length,
    unresolved: rows.filter((row) => row.intervention?.outcomeStatus === "unresolved").length,
    noPlan: rows.filter((row) => !row.intervention).length,
    total: rows.length,
  };
}

function emptySummary(): AdvisoryInterventionsSummary {
  return {
    high: 0,
    moderate: 0,
    low: 0,
    ongoing: 0,
    resolved: 0,
    unresolved: 0,
    noPlan: 0,
    total: 0,
  };
}
