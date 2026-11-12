import { prisma } from "../../lib/prisma.js";
import {
  archivedAdvisoryLearnerIds,
  excludeArchivedLearnerRows,
} from "../../lib/learnerVisibility.js";
import { GRADE_LABELS, GRADE_ORDER } from "../../lib/grades.js";
import { getInterventionStudents } from "../../modules/risk/interventions.service.js";
import { SESSION_TYPES } from "../../modules/interventions/interventions.repository.js";
import type { GuidanceContext } from "./guidance.types.js";

/**
 * Intervention insights — one aggregate read of the term's intervention
 * pipeline for the guidance desk's reporting page.
 *
 * The outcome/session math runs on `Intervention` rows (never the live risk
 * cohort: closed follow-ups leave the cohort, so it cannot report outcomes).
 * The live cohort is still read, but only to add the learners the interventions
 * board currently shows as "No action yet" — flagged by the engine with no
 * follow-up record yet (or only an older term's record). Without them the
 * board and this page disagree on the case count.
 *
 * `Intervention` has no `createdAt`/`resolvedAt` columns, so:
 *  - "opened" is bucketed by `assignedAt` (falling back to the first session);
 *  - "resolved" is bucketed by the last completed session (resolution proxy);
 *  - avg resolution time runs from `assignedAt` to that last completed session.
 *
 * Risk buckets follow the learner's live level while the case is still in the
 * cohort (that is what the board shows); a case that left the cohort keeps
 * `riskLevelAtFlag`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "One-on-one",
  parent_conference: "Parent conference",
  group: "Group session",
  home_visit: "Home visit",
};

const RISK_ORDER = ["High", "Moderate", "Low"] as const;

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, 1));
  return date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function firstDayOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

interface OutcomeBucket {
  total: number;
  resolved: number;
  ongoing: number;
  unresolved: number;
}

function emptyOutcome(): OutcomeBucket {
  return { total: 0, resolved: 0, ongoing: 0, unresolved: 0 };
}

function addOutcome(bucket: OutcomeBucket, outcome: string) {
  bucket.total++;
  if (outcome === "resolved") bucket.resolved++;
  else if (outcome === "unresolved") bucket.unresolved++;
  else bucket.ongoing++;
}

export interface InterventionInsightKpis {
  total: number;
  ongoing: number;
  resolved: number;
  unresolved: number;
  /** Resolved share of closed follow-ups (resolved + unresolved). */
  successRate: number;
  avgResolutionDays: number | null;
  sessionsTotal: number;
  sessionsCompleted: number;
  sessionCompletionRate: number;
}

export interface InterventionInsightTrendRow {
  month: string;
  label: string;
  opened: number;
  resolved: number;
  sessions: number;
  completedSessions: number;
}

export interface InterventionInsightOutcomeRow extends OutcomeBucket {
  key: string;
  label: string;
  /** Resolved share of closed follow-ups in this bucket. */
  rate: number;
}

export interface InterventionInsightSessionTypeRow {
  type: string;
  label: string;
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
}

export interface InterventionInsightSectionRow extends InterventionInsightOutcomeRow {
  section: string;
  grade: string;
}

export interface InterventionInsightsData {
  termLabel: string;
  generatedAt: string;
  kpis: InterventionInsightKpis;
  monthlyTrend: InterventionInsightTrendRow[];
  successByRisk: InterventionInsightOutcomeRow[];
  successByGrade: InterventionInsightOutcomeRow[];
  sessionsByType: InterventionInsightSessionTypeRow[];
  sectionHeat: InterventionInsightSectionRow[];
}

export async function getInterventionInsights(
  ctx: GuidanceContext,
): Promise<InterventionInsightsData> {
  const termId = ctx.termId;

  // Adviser-scoped soft delete (archive): a learner the section adviser removed
  // from the advisory list must not surface on this desk's reporting either —
  // their intervention history, sessions and outcomes are hidden with them
  // (the live cohort below already excludes these learners).
  const archivedLearners = await archivedAdvisoryLearnerIds();

  const [term, interventions] = await Promise.all([
    termId
      ? prisma.term.findUnique({
          where: { id: termId },
          select: {
            termNumber: true,
            startDate: true,
            endDate: true,
            schoolYear: { select: { name: true } },
          },
        })
      : null,
    prisma.intervention.findMany({
      where: {
        ...(termId ? { termId } : {}),
        ...excludeArchivedLearnerRows(archivedLearners),
      },
      select: {
        id: true,
        studentId: true,
        rosterId: true,
        riskLevelAtFlag: true,
        outcomeStatus: true,
        assignedAt: true,
        student: {
          select: {
            gradeLevel: true,
            section: { select: { name: true } },
          },
        },
        roster: {
          select: {
            gradeLevel: true,
            section: { select: { name: true } },
          },
        },
        counselingSessions: {
          select: {
            sessionType: true,
            status: true,
            scheduledAt: true,
            completedAt: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const termLabel = term
    ? `${term.schoolYear.name.split(" ")[0]} · Term ${term.termNumber}`
    : "No active term";

  // The interventions board lists the live risk cohort, so a learner flagged
  // by the engine but with no follow-up record (or only another term's record)
  // still appears there as "No action yet". Read the same cohort here and add
  // those rows below — otherwise the board shows 8 cases and this page 7.
  const countedInterventionIds = new Set(interventions.map((iv) => iv.id));
  const cohort = termId
    ? await getInterventionStudents(
        { page: 1, pageSize: 2000, fullCohort: true, includeRecovered: true },
        { termId, schoolYearId: ctx.schoolYearId },
      )
    : null;
  // The board shows each learner's live risk level, so bucket the cases that
  // are still in the cohort by the same level. Only cases that left the
  // cohort (resolved/unresolved, learner no longer flagged) keep the level
  // recorded when the case was opened.
  const liveLevelByKey = new Map<string, string>();
  for (const s of cohort?.students ?? []) liveLevelByKey.set(s.studentId, s.riskLevel);

  const kpis: InterventionInsightKpis = {
    total: 0,
    ongoing: 0,
    resolved: 0,
    unresolved: 0,
    successRate: 0,
    avgResolutionDays: null,
    sessionsTotal: 0,
    sessionsCompleted: 0,
    sessionCompletionRate: 0,
  };

  const byRisk = new Map<string, OutcomeBucket>();
  for (const level of RISK_ORDER) byRisk.set(level, emptyOutcome());
  const byGrade = new Map<string, OutcomeBucket>();
  for (const grade of GRADE_ORDER) byGrade.set(grade, emptyOutcome());
  const bySection = new Map<string, OutcomeBucket & { section: string; grade: string }>();
  const bySessionType = new Map<
    string,
    { total: number; scheduled: number; completed: number; cancelled: number }
  >();
  for (const type of SESSION_TYPES) {
    bySessionType.set(type, { total: 0, scheduled: 0, completed: 0, cancelled: 0 });
  }

  const buckets = new Map<
    string,
    { opened: number; resolved: number; sessions: number; completedSessions: number }
  >();
  function ensureBucket(key: string) {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { opened: 0, resolved: 0, sessions: 0, completedSessions: 0 };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  let resolutionDaySum = 0;
  let resolutionCount = 0;

  for (const intervention of interventions) {
    kpis.total++;
    if (intervention.outcomeStatus === "resolved") kpis.resolved++;
    else if (intervention.outcomeStatus === "unresolved") kpis.unresolved++;
    else kpis.ongoing++;

    const gradeLevel =
      intervention.student?.gradeLevel ?? intervention.roster?.gradeLevel ?? null;
    const gradeLabel = gradeLevel ? (GRADE_LABELS[gradeLevel] ?? gradeLevel) : "Unknown";
    const sectionName =
      intervention.student?.section?.name ??
      intervention.roster?.section?.name ??
      "Unassigned";

    const riskBucket = byRisk.get(
      (intervention.studentId
        ? liveLevelByKey.get(intervention.studentId)
        : intervention.rosterId
          ? liveLevelByKey.get(`roster:${intervention.rosterId}`)
          : undefined) ?? intervention.riskLevelAtFlag,
    );
    if (riskBucket) addOutcome(riskBucket, intervention.outcomeStatus);

    if (gradeLevel) {
      const gradeBucket = byGrade.get(gradeLevel);
      if (gradeBucket) addOutcome(gradeBucket, intervention.outcomeStatus);
    }

    const sectionKey = `${gradeLevel ?? "unknown"}|${sectionName}`;
    let sectionBucket = bySection.get(sectionKey);
    if (!sectionBucket) {
      sectionBucket = { ...emptyOutcome(), section: sectionName, grade: gradeLabel };
      bySection.set(sectionKey, sectionBucket);
    }
    addOutcome(sectionBucket, intervention.outcomeStatus);

    // Opened date: assignedAt, else the first session created.
    let openedAt: Date | null = intervention.assignedAt ?? null;
    if (!openedAt && intervention.counselingSessions.length > 0) {
      openedAt = intervention.counselingSessions.reduce(
        (min, s) => (s.createdAt < min ? s.createdAt : min),
        intervention.counselingSessions[0].createdAt,
      );
    }

    // Latest completed session = resolution proxy.
    let resolvedAt: Date | null = null;
    for (const session of intervention.counselingSessions) {
      if (session.status !== "completed") continue;
      const at = session.completedAt ?? session.scheduledAt;
      if (!resolvedAt || at > resolvedAt) resolvedAt = at;
    }

    if (openedAt) ensureBucket(monthKey(openedAt)).opened++;
    if (intervention.outcomeStatus === "resolved") {
      const bucketKey = resolvedAt
        ? monthKey(resolvedAt)
        : openedAt
          ? monthKey(openedAt)
          : null;
      if (bucketKey) ensureBucket(bucketKey).resolved++;
      if (openedAt && resolvedAt && resolvedAt >= openedAt) {
        resolutionDaySum += (resolvedAt.getTime() - openedAt.getTime()) / DAY_MS;
        resolutionCount++;
      }
    }

    for (const session of intervention.counselingSessions) {
      kpis.sessionsTotal++;
      if (session.status === "completed") kpis.sessionsCompleted++;

      const typeRow = bySessionType.get(session.sessionType);
      if (typeRow) {
        typeRow.total++;
        if (session.status === "completed") typeRow.completed++;
        else if (session.status === "cancelled") typeRow.cancelled++;
        else typeRow.scheduled++;
      }

      const sessionAt = session.completedAt ?? session.scheduledAt;
      if (sessionAt) {
        const bucket = ensureBucket(monthKey(sessionAt));
        bucket.sessions++;
        if (session.status === "completed") bucket.completedSessions++;
      }
    }
  }

  // Flagged learners the board shows without a follow-up record. They are
  // part of the desk's live caseload, so they count as ongoing and open in the
  // month the engine detected them.
  for (const s of cohort?.students ?? []) {
    const linked = s.intervention?.id;
    if (linked && countedInterventionIds.has(linked)) continue;

    kpis.total++;
    kpis.ongoing++;

    const riskBucket = byRisk.get(s.riskLevel);
    if (riskBucket) addOutcome(riskBucket, "ongoing");

    const gradeBucket = byGrade.get(s.gradeLevel as (typeof GRADE_ORDER)[number]);
    if (gradeBucket) addOutcome(gradeBucket, "ongoing");

    const sectionKey = `${s.gradeLevel}|${s.section}`;
    let sectionBucket = bySection.get(sectionKey);
    if (!sectionBucket) {
      sectionBucket = {
        ...emptyOutcome(),
        section: s.section,
        grade: GRADE_LABELS[s.gradeLevel as keyof typeof GRADE_LABELS] ?? s.gradeLevel,
      };
      bySection.set(sectionKey, sectionBucket);
    }
    addOutcome(sectionBucket, "ongoing");

    if (s.snapshotDate) {
      const at = new Date(s.snapshotDate);
      if (!Number.isNaN(at.getTime())) ensureBucket(monthKey(at)).opened++;
    }
  }

  kpis.successRate = pct(kpis.resolved, kpis.resolved + kpis.unresolved);
  kpis.sessionCompletionRate = pct(kpis.sessionsCompleted, kpis.sessionsTotal);
  kpis.avgResolutionDays =
    resolutionCount > 0 ? Math.round((resolutionDaySum / resolutionCount) * 10) / 10 : null;

  // Trend window: every month in the term range, else the months present in
  // the data (last six at most).
  let monthKeys: string[];
  if (term?.startDate && term?.endDate) {
    monthKeys = [];
    let cursor = firstDayOfMonth(term.startDate);
    const end = firstDayOfMonth(term.endDate);
    while (cursor <= end && monthKeys.length < 12) {
      const key = monthKey(cursor);
      ensureBucket(key);
      monthKeys.push(key);
      cursor = addMonth(cursor);
    }
  } else {
    monthKeys = [...buckets.keys()].sort().slice(-6);
  }

  const monthlyTrend = monthKeys.map((key) => {
    const bucket = buckets.get(key) ?? {
      opened: 0,
      resolved: 0,
      sessions: 0,
      completedSessions: 0,
    };
    return { month: key, label: monthLabel(key), ...bucket };
  });

  const toOutcomeRow = (
    key: string,
    label: string,
    bucket: OutcomeBucket,
  ): InterventionInsightOutcomeRow => ({
    key,
    label,
    ...bucket,
    // Success = resolved over every case opened in the bucket.
    rate: pct(bucket.resolved, bucket.total),
  });

  const successByRisk = RISK_ORDER.map((level) =>
    toOutcomeRow(level, level, byRisk.get(level) ?? emptyOutcome()),
  );

  const successByGrade = GRADE_ORDER.map((grade) =>
    toOutcomeRow(
      grade,
      GRADE_LABELS[grade] ?? grade,
      byGrade.get(grade) ?? emptyOutcome(),
    ),
  );

  const sessionsByType = [...bySessionType.entries()].map(([type, row]) => ({
    type,
    label: SESSION_TYPE_LABELS[type] ?? type,
    ...row,
  }));

  const sectionHeat: InterventionInsightSectionRow[] = [...bySection.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.section,
      section: bucket.section,
      grade: bucket.grade,
      total: bucket.total,
      resolved: bucket.resolved,
      ongoing: bucket.ongoing,
      unresolved: bucket.unresolved,
      // Success = resolved over every case opened for the section.
      rate: pct(bucket.resolved, bucket.total),
    }))
    .sort((a, b) => b.total - a.total || a.section.localeCompare(b.section));

  return {
    termLabel,
    generatedAt: new Date().toISOString(),
    kpis,
    monthlyTrend,
    successByRisk,
    successByGrade,
    sessionsByType,
    sectionHeat,
  };
}
