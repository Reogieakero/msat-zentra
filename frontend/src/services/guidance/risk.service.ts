import { apiClient } from "@/lib/api/client";
import { fetchGuidanceAlerts } from "./alerts.service";
import { fetchGuidanceOverview } from "./overview.service";
import type { GuidanceAlertItem } from "./alerts.types";
import type { GuidanceRiskLevel } from "./guidance.types";
import type { GuidanceRiskFactorRow, GuidanceRiskHeatmap } from "./risk.types";

export async function fetchGuidanceRiskLevels(
  studentIds: string[]
): Promise<Record<string, GuidanceRiskLevel>> {
  // Bound to one page (15). Prefer the batch endpoint to avoid N+1 per-student
  // requests; fall back to bounded per-id fetch only for small sets.
  const unique = [...new Set(studentIds.filter(Boolean))].slice(0, 15);
  if (unique.length === 0) return {};
  try {
    const { data } = await apiClient.get<{ levels: Record<string, string> }>(
      "/api/risk/students/batch",
      { params: { ids: unique.join(",") } },
    );
    const map: Record<string, GuidanceRiskLevel> = {};
    for (const [id, level] of Object.entries(data?.levels ?? {})) {
      if (level === "High" || level === "Moderate" || level === "Low") {
        map[id] = level;
      }
    }
    if (Object.keys(map).length > 0) return map;
  } catch {
    // Fall through to bounded per-id fallback below.
  }
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

// Strict 15/page ceiling (was 100×10=1000 rows max).
const ALERTS_PAGE_SIZE = 15;
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
