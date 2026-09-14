import {
  fetchGuidanceAlerts,
  type GuidanceAlertItem,
} from "../../alerts/components/guidance-alerts-data";
import {
  fetchGuidanceOverview,
  type GuidanceOverviewData,
} from "../../overview/components/guidance-overview-data";

export type { GuidanceOverviewData };

/**
 * Guidance risk data, served only by guidance-scoped backend endpoints.
 *
 * Access rule (mirrors the backend): guidance never browses raw
 * anecdotal_records or principal-only aggregates. The dashboard + heatmap
 * read `/api/guidance/overview` (status-only risk levels, factor totals,
 * per-section level buckets) and `/api/guidance/alerts` (the system-flagged
 * at-risk queue with per-student factor flags). No write-up content, no
 * principal `/api/risk/*` endpoints.
 */

export interface GuidanceRiskFactorRow {
  section: string;
  grade: string;
  academic: number;
  attendance: number;
  behavioral: number;
  high: number;
  moderate: number;
  low: number;
  needsAttention: number;
  /** Flagged students in this section with an ongoing follow-up. */
  followUpOngoing: number;
  /** Flagged students in this section whose follow-up finished (resolved). */
  followUpDone: number;
  /** Flagged students in this section with no follow-up started yet. */
  followUpNone: number;
}

export interface GuidanceRiskHeatmap {
  termLabel: string;
  rows: GuidanceRiskFactorRow[];
  totals: {
    academic: number;
    attendance: number;
    behavioral: number;
    high: number;
    moderate: number;
    low: number;
    needsAttention: number;
    followUpOngoing: number;
    followUpDone: number;
    followUpNone: number;
  };
  /** True when the flagged-student scan stopped early (very large caseload). */
  truncated: boolean;
}

const ALERTS_PAGE_SIZE = 100;
const MAX_ALERT_PAGES = 10;

async function fetchAllAlerts(): Promise<{
  alerts: GuidanceAlertItem[];
  truncated: boolean;
}> {
  const first = await fetchGuidanceAlerts({ page: 1, pageSize: ALERTS_PAGE_SIZE });
  const pages = Math.min(first.totalPages, MAX_ALERT_PAGES);
  if (pages <= 1) {
    return { alerts: first.alerts, truncated: first.totalPages > MAX_ALERT_PAGES };
  }
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      fetchGuidanceAlerts({ page: i + 2, pageSize: ALERTS_PAGE_SIZE })
    )
  );
  return {
    alerts: [first, ...rest].flatMap((p) => p.alerts),
    truncated: first.totalPages > MAX_ALERT_PAGES,
  };
}

/**
 * Section x risk-factor matrix for the guidance heatmap page. Level buckets
 * come from the overview (full enrolled cohort per section); factor columns
 * aggregate the flagged-student queue (at-risk students only).
 */
export async function fetchGuidanceRiskHeatmap(): Promise<GuidanceRiskHeatmap> {
  const [overview, { alerts, truncated }] = await Promise.all([
    fetchGuidanceOverview(),
    fetchAllAlerts(),
  ]);

  const factorsBySection = new Map<
    string,
    {
      academic: number;
      attendance: number;
      behavioral: number;
      followUpOngoing: number;
      followUpDone: number;
      followUpNone: number;
    }
  >();
  const emptyFactors = () => ({
    academic: 0,
    attendance: 0,
    behavioral: 0,
    followUpOngoing: 0,
    followUpDone: 0,
    followUpNone: 0,
  });
  for (const alert of alerts) {
    const key = alert.section || "—";
    const entry = factorsBySection.get(key) ?? emptyFactors();
    if (alert.factors.academic) entry.academic += 1;
    if (alert.factors.attendance) entry.attendance += 1;
    if (alert.factors.behavioral) entry.behavioral += 1;
    // Follow-up state per flagged student: ongoing, finished
    // (resolved / closed), or no follow-up started yet.
    if (!alert.interventionOutcome) entry.followUpNone += 1;
    else if (alert.interventionOutcome === "ongoing") entry.followUpOngoing += 1;
    else entry.followUpDone += 1;
    factorsBySection.set(key, entry);
  }

  const rows: GuidanceRiskFactorRow[] = overview.sectionHeat.map((s) => {
    const factors = factorsBySection.get(s.section) ?? emptyFactors();
    return {
      section: s.section,
      grade: s.grade,
      ...factors,
      high: s.high,
      moderate: s.moderate,
      low: s.low,
      needsAttention: s.high + s.moderate,
    };
  });
  // Flagged students whose section is missing from the overview cohort
  // (e.g. section archived mid-year) still get a row so nobody is hidden.
  for (const [section, factors] of factorsBySection) {
    if (!rows.some((r) => r.section === section)) {
      rows.push({
        section,
        grade: "—",
        ...factors,
        high: 0,
        moderate: 0,
        low: 0,
        needsAttention: 0,
      });
    }
  }
  rows.sort(
    (a, b) => b.needsAttention - a.needsAttention || a.section.localeCompare(b.section)
  );

  const totals = rows.reduce(
    (acc, r) => ({
      academic: acc.academic + r.academic,
      attendance: acc.attendance + r.attendance,
      behavioral: acc.behavioral + r.behavioral,
      high: acc.high + r.high,
      moderate: acc.moderate + r.moderate,
      low: acc.low + r.low,
      needsAttention: acc.needsAttention + r.needsAttention,
      followUpOngoing: acc.followUpOngoing + r.followUpOngoing,
      followUpDone: acc.followUpDone + r.followUpDone,
      followUpNone: acc.followUpNone + r.followUpNone,
    }),
    {
      academic: 0,
      attendance: 0,
      behavioral: 0,
      high: 0,
      moderate: 0,
      low: 0,
      needsAttention: 0,
      followUpOngoing: 0,
      followUpDone: 0,
      followUpNone: 0,
    }
  );

  return { termLabel: overview.termLabel, rows, totals, truncated };
}

export { fetchGuidanceOverview };
