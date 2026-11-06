export type RiskLevelBucket = "High" | "Moderate" | "Low" | "Unassessed";

export type RiskDesk = "clinic" | "guidance";

export interface RiskCaseRow {
  id: string;
  section: string;
  category: string;
}

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

export const LEVEL_WORDS: Record<RiskLevelBucket, string> = {
  High: "Needs urgent attention",
  Moderate: "Keep an eye on",
  Low: "Doing okay",
  Unassessed: "Not assessed yet",
};

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

export interface RiskDashboard {
  totalCases: number;
  totalStudents: number;
  highCount: number;
  levelMix: LevelSlice[];
  categoryRows: CategorySlice[];
  matrixCategories: string[];
  matrix: SectionMatrixRow[];
  colTotals: number[];
}

const MAX_MATRIX_COLUMNS = 7;

function toCategoryLabel(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (text === "" || text === "—") return "Uncategorized";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildRiskDashboard(
  rows: RiskCaseRow[],
  riskByStudent: Record<string, string>,
  caseToStudent: Record<string, string | null>,
  isDark = false
): RiskDashboard {
  const levelOf = new Map<string, RiskLevelBucket>();
  for (const row of rows) {
    const sid = caseToStudent[row.id] ?? null;
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
      label: LEVEL_WORDS[level],
      count: [...levelOf.values()].filter((v) => v === level).length,
    }))
    .filter((s) => s.count > 0);

  const categoryCounts = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    const raw = row.category?.trim() ?? "";
    const key = raw === "" || raw === "—" ? "uncategorized" : raw.toLowerCase();
    const label = toCategoryLabel(raw);
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
    const label = toCategoryLabel(raw);
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

export interface TrendWeek {
  label: string;
}

export interface TrendSeries {
  key: string;
  label: string;
  counts: number[];
}

export interface CategoryTrend {
  weeks: TrendWeek[];
  series: TrendSeries[];
  total: number;
}

const TREND_WEEKS = 12;
const TREND_SERIES_CAP = 4;
const DAY_MS = 86_400_000;

function shortWeekLabel(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

export function buildCategoryTrend(
  items: { category: string; referredAt: string }[],
  weeks: number = TREND_WEEKS,
): CategoryTrend {
  const nowMs = Date.now();
  const buckets: TrendWeek[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(nowMs - (i * 7 + 6) * DAY_MS);
    buckets.push({ label: shortWeekLabel(start) });
  }
  const totals = new Map<string, { label: string; count: number; counts: number[] }>();
  let total = 0;
  for (const item of items) {
    const t = new Date(item.referredAt).getTime();
    if (!Number.isFinite(t)) continue;
    const ageWeeks = Math.floor((nowMs - t) / (7 * DAY_MS));
    if (ageWeeks < 0 || ageWeeks >= weeks) continue;
    const raw = (item.category || "").trim();
    const key = raw === "" || raw === "—" ? "uncategorized" : raw.toLowerCase();
    const label =
      key === "uncategorized" ? "Uncategorized" : raw.charAt(0).toUpperCase() + raw.slice(1);
    let entry = totals.get(key);
    if (!entry) {
      entry = { label, count: 0, counts: [] };
      totals.set(key, entry);
    }
    const slot = weeks - 1 - ageWeeks;
    entry.counts[slot] = (entry.counts[slot] ?? 0) + 1;
    entry.count += 1;
    total += 1;
  }
  const ranked = [...totals.entries()]
    .map(([key, v]) => ({ key, label: v.label, count: v.count, counts: v.counts }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const head = ranked.slice(0, TREND_SERIES_CAP);
  const tail = ranked.slice(TREND_SERIES_CAP);
  const series: TrendSeries[] = head.map((r) => ({
    key: r.key,
    label: r.label,
    counts: Array.from({ length: weeks }, (_, i) => r.counts[i] ?? 0),
  }));
  if (tail.length > 0) {
    series.push({
      key: "other",
      label: "Other",
      counts: Array.from({ length: weeks }, (_, i) =>
        tail.reduce((s, r) => s + (r.counts[i] ?? 0), 0),
      ),
    });
  }
  return { weeks: buckets, series, total };
}

export function interpretCategoryTrend(trend: CategoryTrend): string {
  if (trend.total === 0 || trend.series.length === 0)
    return `No referrals in the last 12 weeks.`;
  const top = [...trend.series].sort(
    (a, b) =>
      b.counts.reduce((s, n) => s + n, 0) - a.counts.reduce((s, n) => s + n, 0),
  )[0];
  const topTotal = top.counts.reduce((s, n) => s + n, 0);
  const recent = top.counts.slice(-4).reduce((s, n) => s + n, 0);
  const prior = top.counts.slice(-8, -4).reduce((s, n) => s + n, 0);
  const momentum =
    recent > prior
      ? "rising over the last month"
      : recent < prior
        ? "easing off over the last month"
        : "holding steady over the last month";
  return `${top.label} leads with ${topTotal} of ${trend.total} cases in 12 weeks, ${momentum}.`;
}

export function interpretLevelMix(
  mix: LevelSlice[],
  totalStudents: number,
  desk: RiskDesk
): string {
  const who = desk === "clinic" ? "the nurse" : "guidance";
  if (totalStudents === 0)
    return `No students here yet — levels will appear once cases are routed to ${who}.`;
  const assessed = mix
    .filter((s) => s.key !== "Unassessed")
    .reduce((s, r) => s + r.count, 0);
  const unassessed = mix.find((s) => s.key === "Unassessed")?.count ?? 0;
  const insights: string[] = [];
  if (assessed === 0) {
    insights.push(
      `${totalStudents} ${plural(totalStudents, "student", "students")} here, none assessed yet — levels show up on their own once records are checked. Nothing to do.`
    );
    return insights.join(" ");
  }
  const top = mix.filter((s) => s.key !== "Unassessed").sort((a, b) => b.count - a.count)[0];
  const pct = Math.round((top.count / assessed) * 100);
  insights.push(
    `Most students (${top.count} of ${assessed}, ${pct}%) are "${LEVEL_WORDS[top.key].toLowerCase()}".`
  );
  const high = mix.find((s) => s.key === "High")?.count ?? 0;
  if (high > 0) {
    insights.push(
      `${high} ${plural(high, "student", "students")} need${high === 1 ? "s" : ""} urgent attention — start with them.`
    );
  }
  if (unassessed > 0) {
    insights.push(
      `${unassessed} ${plural(unassessed, "student", "students")} ${unassessed === 1 ? "isn't" : "aren't"} assessed yet — levels appear on their own once records are checked. Nothing to do.`
    );
  }
  return insights.join(" ");
}

export function interpretCategoryMix(rows: CategorySlice[], total: number): string {
  if (total === 0 || rows.length === 0)
    return `No grouped cases here yet.`;
  const insights: string[] = [];
  if (rows.length === 1) {
    insights.push(
      `All ${total} ${plural(total, "case", "cases")} ${total === 1 ? "is" : "are"} about ${rows[0].label.toLowerCase()}.`
    );
  } else {
    const top = rows[0];
    insights.push(
      `Most cases are about ${top.label.toLowerCase()} (${top.count} of ${total}).`
    );
    const second = rows[1];
    insights.push(`${second.label} comes next with ${second.count}.`);
    const topTwoPct = Math.round(((rows[0].count + rows[1].count) / total) * 100);
    if (topTwoPct >= 75) {
      insights.push(
        `Almost everything (${topTwoPct}%) comes from just two groups — expect the same kinds of cases to keep coming.`
      );
    }
  }
  return insights.join(" ");
}

export function interpretSectionMatrix(
  matrix: SectionMatrixRow[],
  categories: string[],
  total: number,
): string {
  if (total === 0 || matrix.length === 0)
    return `No sections here yet — this fills in as cases arrive.`;
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
      `${hot.section} has the most ${hot.category.toLowerCase()} cases (${hot.count}) — start check-ins there.`
    );
  }
  const topSection = matrix[0];
  const share = Math.round((topSection.total / total) * 100);
  if (matrix.length > 1) {
    insights.push(
      `${topSection.section} carries the heaviest load at ${share}% of cases across ${matrix.length} sections.`
    );
  } else {
    insights.push(`All cases come from ${topSection.section}.`);
  }
  return insights.join(" ");
}
