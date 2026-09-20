import { apiClient } from "@/lib/api/client";
import {
  isNurseScope,
  toQueueRow,
  type NurseQueueRow,
  type RawReferral,
} from "../../overview/components/nurse-overview-data";

/**
 * Nurse risk dashboard data — desk-scoped only.
 *
 * The nurse role is locked out of the principal `/api/risk/*` aggregates,
 * so every number here is rebuilt client-side from the nurse's own
 * referrals (`GET /api/referrals/`, server-scoped to the nurse's desk) plus
 * the per-student risk-level projection the nurse is allowed to read
 * (`GET /api/risk/students/:id` → { lrn, riskLevel }). Counts and levels
 * only — never confidential notes from other roles.
 */

export type RiskLevelBucket = "High" | "Moderate" | "Low" | "Unassessed";

/**
 * Slice fills per color mode. SVG `fill` attributes cannot reliably resolve
 * CSS `var()` references, so charts pick resolved hexes from the active
 * theme instead — darkest/most prominent always marks the most urgent
 * bucket in both modes.
 */
export const LEVEL_COLORS_LIGHT: Record<RiskLevelBucket, string> = {
  High: "#171717",
  Moderate: "#525252",
  Low: "#a3a3a3",
  Unassessed: "#e5e5e5",
};

export const LEVEL_COLORS_DARK: Record<RiskLevelBucket, string> = {
  High: "#fafafa",
  Moderate: "#a3a3a3",
  Low: "#525252",
  Unassessed: "#404040",
};

/** Neutral ink scale, rank-ordered — leader stays most prominent per mode. */
export const CATEGORY_SHADES_LIGHT = [
  "#171717",
  "#404040",
  "#525252",
  "#737373",
  "#a3a3a3",
  "#d4d4d4",
  "#e5e5e5",
];

export const CATEGORY_SHADES_DARK = [
  "#fafafa",
  "#d4d4d4",
  "#a3a3a3",
  "#737373",
  "#525252",
  "#404040",
  "#2e2e2e",
];

/** Donut slice separator — must match the card surface per mode. */
export const CARD_SURFACE_LIGHT = "#ffffff";
export const CARD_SURFACE_DARK = "#2e2e2e";

export interface LevelSlice {
  key: RiskLevelBucket;
  label: string;
  count: number;
}

export interface CategorySlice {
  key: string;
  label: string;
  count: number;
  fill: string;
}

export interface SectionMatrixRow {
  section: string;
  counts: number[];
  total: number;
}

export interface NurseRiskDashboard {
  totalCases: number;
  totalStudents: number;
  highCount: number;
  levelMix: LevelSlice[];
  categoryRows: CategorySlice[];
  /** Column labels for the matrix (capped, remainder rolled into Other). */
  matrixCategories: string[];
  matrix: SectionMatrixRow[];
  colTotals: number[];
}

/** Heat columns cap at 7 named categories — the tail rolls into Other. */
const MAX_MATRIX_COLUMNS = 7;

export async function fetchNurseRisk(): Promise<{
  rows: NurseQueueRow[];
  referralToStudent: Record<string, string>;
}> {
  const { data } = await apiClient.get<RawReferral[] | { referrals: RawReferral[] }>(
    "/api/referrals/"
  );
  const list = Array.isArray(data) ? data : (data?.referrals ?? []);
  const scoped = list.filter(isNurseScope);
  const rows = scoped.map(toQueueRow);
  const referralToStudent: Record<string, string> = {};
  for (const r of scoped) {
    const sid = r.student?.userId ?? r.roster?.id ?? null;
    if (sid) referralToStudent[r.id] = sid;
  }
  return { rows, referralToStudent };
}

export function buildNurseRiskDashboard(
  rows: NurseQueueRow[],
  riskByStudent: Record<string, string>,
  referralToStudent: Record<string, string>,
  isDark = false
): NurseRiskDashboard {
  // Risk levels are per student — dedupe cases that share a student so one
  // frequently-referred learner never inflates a bucket. Cases whose student
  // id is unknown (or whose level lookup failed) read as Unassessed.
  const levelOf = new Map<string, RiskLevelBucket>();
  for (const row of rows) {
    const sid = referralToStudent[row.id];
    const key = sid ?? `case:${row.id}`;
    if (levelOf.has(key)) continue;
    const level = sid ? riskByStudent[sid] : undefined;
    levelOf.set(
      key,
      level === "High" || level === "Moderate" || level === "Low" ? level : "Unassessed"
    );
  }
  const levelOrder: RiskLevelBucket[] = ["High", "Moderate", "Low", "Unassessed"];
  const levelMix: LevelSlice[] = levelOrder
    .map((level) => ({
      key: level,
      label: level === "Unassessed" ? "Unassessed" : `${level} risk`,
      count: [...levelOf.values()].filter((v) => v === level).length,
    }))
    .filter((s) => s.count > 0);

  const categoryCounts = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    const raw = row.category?.trim() ?? "";
    const key = raw === "" || raw === "—" ? "uncategorized" : raw.toLowerCase();
    const label = key === "uncategorized" ? "Uncategorized" : raw;
    const prev = categoryCounts.get(key);
    categoryCounts.set(key, { label, count: (prev?.count ?? 0) + 1 });
  }
  const shades = isDark ? CATEGORY_SHADES_DARK : CATEGORY_SHADES_LIGHT;
  const categoryRows: CategorySlice[] = [...categoryCounts.entries()]
    .map(([key, v]) => ({ key, ...v, fill: "" }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((r, i) => ({
      ...r,
      fill: shades[i] ?? shades[shades.length - 1],
    }));

  // Section × category matrix — status-only counts, no identities.
  const matrixCategories = categoryRows
    .slice(0, MAX_MATRIX_COLUMNS)
    .map((r) => r.label);
  const hasOther = categoryRows.length > MAX_MATRIX_COLUMNS;
  const columns = hasOther ? [...matrixCategories, "Other"] : matrixCategories;
  const colIndex = new Map(columns.map((c, i) => [c, i]));
  const cells = new Map<string, number[]>();
  for (const row of rows) {
    const section = row.section?.trim() || "—";
    const raw = row.category?.trim() ?? "";
    const label = raw === "" || raw === "—" ? "Uncategorized" : raw;
    // Labels outside the capped column set roll into Other; without an
    // Other column there is nothing to roll into, so the case is skipped.
    const col = colIndex.get(label) ?? (hasOther ? colIndex.get("Other")! : -1);
    if (col < 0) continue;
    const counts = cells.get(section) ?? columns.map(() => 0);
    counts[col] += 1;
    cells.set(section, counts);
  }
  const matrix: SectionMatrixRow[] = [...cells.entries()]
    .map(([section, counts]) => ({
      section,
      counts,
      total: counts.reduce((s, n) => s + n, 0),
    }))
    .sort((a, b) => b.total - a.total || a.section.localeCompare(b.section));
  const colTotals = columns.map((_, i) => matrix.reduce((s, r) => s + r.counts[i], 0));

  return {
    totalCases: rows.length,
    totalStudents: levelOf.size,
    highCount: levelMix.find((s) => s.key === "High")?.count ?? 0,
    levelMix,
    categoryRows,
    matrixCategories: columns,
    matrix,
    colTotals,
  };
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function interpretLevelMix(mix: LevelSlice[], totalStudents: number): string {
  if (totalStudents === 0) return "No students on the clinic desk yet — levels will appear here once cases are routed to the nurse.";
  const assessed = mix
    .filter((s) => s.key !== "Unassessed")
    .reduce((s, r) => s + r.count, 0);
  const unassessed = mix.find((s) => s.key === "Unassessed")?.count ?? 0;
  const insights: string[] = [];
  if (assessed === 0) {
    insights.push(
      `${totalStudents} ${plural(totalStudents, "student", "students")} on the desk, none assessed yet — levels resolve the next time each learner's record is evaluated.`
    );
    return insights.join(" ");
  }
  const top = mix.filter((s) => s.key !== "Unassessed").sort((a, b) => b.count - a.count)[0];
  const pct = Math.round((top.count / assessed) * 100);
  insights.push(
    `${top.count} of ${assessed} assessed ${plural(assessed, "student", "students")} (${pct}%) ${top.key === "High" ? "need priority attention" : top.key === "Low" ? "sit at low risk" : "sit at moderate risk"}.`
  );
  const high = mix.find((s) => s.key === "High")?.count ?? 0;
  if (high > 0 && top.key !== "High") {
    insights.push(
      `${high} high-risk ${plural(high, "student", "students")} on the desk — review their cases first.`
    );
  }
  if (unassessed > 0) {
    insights.push(
      `${unassessed} ${plural(unassessed, "student", "students")} still unassessed; their levels fill in as records evaluate.`
    );
  }
  return insights.join(" ");
}

export function interpretCategoryMix(
  rows: CategorySlice[],
  total: number
): string {
  if (total === 0 || rows.length === 0)
    return "No categorized cases on the clinic desk yet.";
  const insights: string[] = [];
  if (rows.length === 1) {
    insights.push(
      `All ${total} ${plural(total, "case", "cases")} fall under ${rows[0].label.toLowerCase()}.`
    );
  } else {
    const top = rows[0];
    const pct = Math.round((top.count / total) * 100);
    insights.push(
      `${top.label} leads at ${pct}% (${top.count} of ${total} cases).`
    );
    const second = rows[1];
    const secondPct = Math.round((second.count / total) * 100);
    insights.push(`${second.label} follows at ${secondPct}%.`);
    if (rows.length > 2) {
      const remaining = rows.slice(2).reduce((s, r) => s + r.count, 0);
      const remainingPct = Math.round((remaining / total) * 100);
      insights.push(
        `${rows.length - 2} other ${plural(rows.length - 2, "category", "categories")} account for the remaining ${remainingPct}%.`
      );
    }
    const topTwoPct = Math.round(((rows[0].count + rows[1].count) / total) * 100);
    if (topTwoPct >= 75) {
      insights.push(
        `${topTwoPct}% of the desk concentrates in two categories — expect repeat presentations from the same groups.`
      );
    }
  }
  return insights.join(" ");
}

export function interpretSectionMatrix(
  matrix: SectionMatrixRow[],
  categories: string[],
  total: number
): string {
  if (total === 0 || matrix.length === 0)
    return "No section data yet — the matrix fills in as cases land on the clinic desk.";
  let hot = { section: matrix[0].section, category: categories[0] ?? "", count: 0 };
  for (const row of matrix) {
    row.counts.forEach((count, i) => {
      if (count > hot.count) {
        hot = { section: row.section, category: categories[i] ?? "", count };
      }
    });
  }
  const insights: string[] = [];
  if (hot.count > 0) {
    insights.push(
      `${hot.section} leads ${hot.category.toLowerCase()} cases with ${hot.count} on the desk.`
    );
  }
  const topSection = matrix[0];
  const share = Math.round((topSection.total / total) * 100);
  if (matrix.length > 1) {
    insights.push(
      `${topSection.section} carries the heaviest load at ${share}% of desk cases across ${matrix.length} sections.`
    );
  } else {
    insights.push(`All desk cases come from ${topSection.section}.`);
  }
  return insights.join(" ");
}
