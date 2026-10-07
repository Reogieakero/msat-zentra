// Live rule-based risk levels for the guidance desk. Never throws — ids
// with no result are simply absent from the map (table shows "—").
import { apiClient } from "@/lib/api/client";
import { fetchGuidanceAlerts } from "./alerts.service";
import { fetchGuidanceOverview } from "./overview.service";
import type { GuidanceAlertItem } from "./alerts.types";
import type { GuidanceRiskLevel } from "./guidance.types";
import type { GuidanceRiskFactorRow, GuidanceRiskHeatmap } from "./risk.types";

// Live rule-based risk level per referred student (GET /api/risk/students/:id
// → { lrn, riskLevel }). The guidance role is allowed this limited
// projection, and the endpoint serves roster ids too — pass the referral's
// studentId (account or roster) so every row resolves a level.
// Resolves each id independently so one failure never blocks the rest;
// ids with no result are simply absent from the map (table shows "—").
export async function fetchGuidanceRiskLevels(
  studentIds: string[]
): Promise<Record<string, GuidanceRiskLevel>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const settled = await Promise.allSettled(
    unique.map(async (id) => {
      const { data } = await apiClient.get<{ lrn: string; riskLevel: GuidanceRiskLevel }>(
        `/api/risk/students/${id}`
      );
      return { id, riskLevel: data?.riskLevel ?? null };
    })
  );
  const map: Record<string, GuidanceRiskLevel> = {};
  for (const s of settled) {
    if (
      s.status === "fulfilled" &&
      s.value.riskLevel !== null &&
      (s.value.riskLevel === "High" ||
        s.value.riskLevel === "Moderate" ||
        s.value.riskLevel === "Low")
    ) {
      map[s.value.id] = s.value.riskLevel;
    }
  }
  return map;
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
 *
 * Guidance risk data, served only by guidance-scoped backend endpoints.
 * Guidance never browses raw anecdotal_records or principal-only
 * aggregates: this reads `/api/guidance/overview` (status-only risk
 * levels, factor totals, per-section level buckets) and
 * `/api/guidance/alerts` (the system-flagged at-risk queue with
 * per-student factor flags). No write-up content, no `/api/risk/*`.
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
