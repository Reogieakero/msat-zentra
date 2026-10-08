import type {
  GuidanceReferralItem,
  GuidanceRiskLevel,
} from "./guidance.types";

export interface GuidanceAdmReportActionCount {
  action: string;
  label: string;
  count: number;
}

export interface GuidanceAdmReportTrendWeek {
  week: string;
  label: string;
  count: number;
}

export interface GuidanceAdmReferralsData {
  total: number;
  actions: GuidanceAdmReportActionCount[];
  trend: GuidanceAdmReportTrendWeek[];

  queue: GuidanceReferralItem[];

  desk: GuidanceReferralItem[];
}

export interface GuidanceAdmFinding {
  key: string;
  label: string;
  value: string;
  hint: string;
}

export interface GuidanceAdmCategorySlice {
  key: string;
  label: string;
  count: number;
  share: number;
}

export interface GuidanceAdmBottleneck {
  id: string;
  student: string;
  section: string;
  kind: string;
  waitingDays: number;
  reason: string;
}

export interface GuidanceAdmRecommendation {
  key: string;
  title: string;
  detail: string;
  count: number;
  href: string | null;
}

export interface GuidanceAdmResponseStats {
  longestDays: number | null;
  avgDays: number | null;
  measured: number;
}

export interface GuidanceAdmInsightsData {
  total: number;
  findings: GuidanceAdmFinding[];
  categories: GuidanceAdmCategorySlice[];
  bottlenecks: GuidanceAdmBottleneck[];
  recommendations: GuidanceAdmRecommendation[];
  response: GuidanceAdmResponseStats;
}

const DAY_MS = 86_400_000;
const TREND_WEEKS = 12;
const BOTTLENECK_DAYS = 7;
const BOTTLENECK_TOP = 5;

const ACTION_ORDER = [
  "needs_review",
  "endorsed",
  "booked",
  "followup",
  "done",
  "rejected",
  "escalated",
];

function actionRank(key: string): number {
  const i = ACTION_ORDER.indexOf(key);
  return i === -1 ? 99 : i;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function guidanceWaitingDays(item: GuidanceReferralItem): number | null {
  const referred = parseDay(item.date);
  if (!referred) return null;
  return Math.max(0, wholeDaysBetween(referred, startOfToday()));
}

function referredTimeMs(item: GuidanceReferralItem): number {
  const d = parseDay(item.date);
  return d ? d.getTime() : Number.POSITIVE_INFINITY;
}

function shortLabel(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function titleCase(raw: string): string {
  return raw
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function deriveGuidanceActionStatus(
  type: string,
  status: string,
  sessions: { status?: string | null }[]
): { key: string; label: string } {
  const hasScheduled = sessions.some((s) => s.status === "scheduled");
  const hasCompleted = sessions.some((s) => s.status === "completed");
  const isEndorsedCase = type === "ADM" && status === "in_progress";

  if (isEndorsedCase) return { key: "endorsed", label: "Endorsed" };
  if (status === "dismissed") return { key: "rejected", label: "Rejected" };
  if (status === "resolved") return { key: "done", label: "Done" };
  if (status === "follow_up") return { key: "followup", label: "Follow-up" };
  if (hasScheduled) return { key: "booked", label: "Booked session" };
  if (hasCompleted) return { key: "done_session", label: "Done session" };
  if (status === "pending") return { key: "needs_review", label: "Needs review" };
  if (status === "escalated") return { key: "escalated", label: "Escalated" };
  if (status === "info_requested") return { key: "info_requested", label: "Needs info" };
  return { key: status, label: titleCase(status) };
}

export function buildGuidanceAdmReferrals(
  items: GuidanceReferralItem[]
): GuidanceAdmReferralsData {
  const seen = new Map<string, GuidanceReferralItem>();
  const seenAdm = new Map<string, GuidanceReferralItem>();
  for (const r of items) {
    if (!seen.has(r.id)) seen.set(r.id, r);
    if (r.type !== "ADM") continue;
    if (!seenAdm.has(r.id)) seenAdm.set(r.id, r);
  }
  const byReferredDesc = (a: GuidanceReferralItem, b: GuidanceReferralItem) =>
    referredTimeMs(b) - referredTimeMs(a);
  const queue = [...seenAdm.values()].sort(byReferredDesc);
  const desk = [...seen.values()].sort(byReferredDesc);

  const counts = new Map<string, { label: string; count: number }>();
  for (const row of desk) {
    const action = deriveGuidanceActionStatus(row.type, row.status, row.sessions);

    const key = action.key === "done_session" ? "done" : action.key;
    const label = key === "done" ? "Done" : action.label;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { label, count: 1 });
  }
  const actions = [...counts.entries()]
    .map(([action, { label, count }]) => ({ action, label, count }))
    .sort((a, b) => actionRank(a.action) - actionRank(b.action) || b.count - a.count);

  const nowMs = Date.now();
  const trend: GuidanceAdmReportTrendWeek[] = [];
  const trendIndex = new Map<string, number>();
  for (let i = TREND_WEEKS - 1; i >= 0; i--) {
    const start = new Date(nowMs - (i * 7 + 6) * DAY_MS);
    const week = Number.isNaN(start.getTime())
      ? ""
      : `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    if (!week || trendIndex.has(week)) continue;
    trendIndex.set(week, trend.length);
    trend.push({ week, label: shortLabel(start), count: 0 });
  }
  for (const row of desk) {
    const t = parseDay(row.date)?.getTime();
    if (t === undefined || !Number.isFinite(t)) continue;
    const ageWeeks = Math.floor((nowMs - (t as number)) / (7 * DAY_MS));
    if (ageWeeks < 0 || ageWeeks >= TREND_WEEKS) continue;
    const idx = trend.length - 1 - ageWeeks;
    if (idx >= 0 && idx < trend.length) trend[idx].count += 1;
  }

  return { total: desk.length, actions, trend, queue, desk };
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

function firstHandlingMs(row: GuidanceReferralItem): number | null {
  const referred = parseDay(row.date)?.getTime();
  if (referred === undefined || !Number.isFinite(referred)) return null;
  const ref = referred as number;
  const bookings = row.sessions
    .map((s) => new Date(s.createdAt ?? "").getTime())
    .filter((t) => Number.isFinite(t) && t >= ref);
  if (bookings.length > 0) return Math.min(...bookings) - ref;
  if (row.status !== "pending") {
    const t = new Date(row.lastActionAt ?? "").getTime();
    if (Number.isFinite(t) && t >= ref) return t - ref;
  }
  return null;
}

export function buildGuidanceAdmInsights(
  items: GuidanceReferralItem[],
  riskByStudent: Record<string, GuidanceRiskLevel> = {}
): GuidanceAdmInsightsData {
  const rows = items;
  const total = rows.length;
  const pending = rows.filter((r) => r.status === "pending");
  const admPending = pending.filter((r) => r.type === "ADM").length;
  const counselingPending = pending.length - admPending;
  const waits = pending
    .map((r) => guidanceWaitingDays(r))
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d));
  const avgWaiting =
    waits.length === 0 ? null : waits.reduce((sum, d) => sum + d, 0) / waits.length;
  const endorsed = rows.filter(
    (r) => deriveGuidanceActionStatus(r.type, r.status, r.sessions).key === "endorsed"
  ).length;
  const rejected = rows.filter(
    (r) =>
      r.type === "ADM" &&
      deriveGuidanceActionStatus(r.type, r.status, r.sessions).key === "rejected"
  ).length;
  const decided = endorsed + rejected;
  const endorsementRate = decided === 0 ? null : Math.round((endorsed / decided) * 100);

  const findings: GuidanceAdmFinding[] = [
    {
      key: "total",
      label: "Referrals on your desk",
      value: String(total),
      hint: total === 0 ? "No referrals on your desk yet." : `${pending.length} needing action.`,
    },
    {
      key: "awaiting",
      label: "Awaiting action",
      value: String(pending.length),
      hint:
        pending.length === 0
          ? "Every case has a decision."
          : `${admPending} ADM · ${counselingPending} counseling.`,
    },
    {
      key: "waiting",
      label: "Avg. waiting time",
      value: avgWaiting === null ? "—" : `${avgWaiting.toFixed(1)}d`,
      hint: avgWaiting === null ? "No pending cases to measure." : "Across cases still waiting.",
    },
    {
      key: "endorsed",
      label: "ADM endorsement rate",
      value: endorsementRate === null ? "—" : `${endorsementRate}%`,
      hint:
        endorsementRate === null
          ? "No decided ADM cases yet."
          : `${endorsed} of ${decided} decided ADM cases endorsed.`,
    },
  ];

  const catCounts = new Map<string, number>();
  for (const r of rows) {
    const key = (r.category || "unspecified").trim().toLowerCase() || "unspecified";
    catCounts.set(key, (catCounts.get(key) ?? 0) + 1);
  }
  const categories = [...catCounts.entries()]
    .map(([key, count]) => ({
      key,
      label: capitalize(key),
      count,
      share: total === 0 ? 0 : Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const bottlenecks = pending
    .map((r) => ({ row: r, waiting: guidanceWaitingDays(r) }))
    .filter(
      (e): e is { row: GuidanceReferralItem; waiting: number } =>
        typeof e.waiting === "number" && Number.isFinite(e.waiting)
    )
    .sort((a, b) => b.waiting - a.waiting)
    .slice(0, BOTTLENECK_TOP)
    .map(({ row: r, waiting }) => ({
      id: r.id,
      student: r.student || "Unknown student",
      section: r.section || "",
      kind: r.type || "",
      waitingDays: waiting,
      reason: r.reason || "",
    }));

  const isAdm = (r: { type: string }) => r.type === "ADM";
  const bookedAdm = rows.filter(
    (r) => isAdm(r) && r.sessions.some((s) => s.status === "scheduled")
  ).length;
  const bookedCounseling = rows.filter(
    (r) => !isAdm(r) && r.sessions.some((s) => s.status === "scheduled")
  ).length;
  const followAdm = rows.filter((r) => isAdm(r) && r.status === "follow_up").length;
  const followCounseling = rows.filter(
    (r) => !isAdm(r) && r.status === "follow_up"
  ).length;
  const highRisk = rows.filter(
    (r) => r.studentId && riskByStudent[r.studentId] === "High"
  ).length;
  const staleAdm = pending.filter(
    (r) => isAdm(r) && (guidanceWaitingDays(r) ?? 0) > BOTTLENECK_DAYS
  ).length;
  const staleCounseling = pending.filter(
    (r) => !isAdm(r) && (guidanceWaitingDays(r) ?? 0) > BOTTLENECK_DAYS
  ).length;

  const recommendations: GuidanceAdmRecommendation[] = [];
  if (admPending > 0) {
    recommendations.push({
      key: "review",
      title: `Review ${admPending} ADM case${admPending === 1 ? "" : "s"} awaiting consultation`,
      detail: "Endorse or reject them from the ADM timeline to keep the pipeline moving.",
      count: admPending,
      href: "/guidance/referrals/adm",
    });
  }
  if (counselingPending > 0) {
    recommendations.push({
      key: "counseling",
      title: `Start handling ${counselingPending} counseling case${counselingPending === 1 ? "" : "s"}`,
      detail: "Accept them from the Counseling Cases timeline to begin care.",
      count: counselingPending,
      href: "/guidance/referrals/counseling",
    });
  }
  if (bookedAdm > 0) {
    recommendations.push({
      key: "sessions-adm",
      title: `Finish or reschedule ${bookedAdm} booked ADM session${bookedAdm === 1 ? "" : "s"}`,
      detail: "ADM cases with upcoming sessions can't move until the session is done or moved.",
      count: bookedAdm,
      href: "/guidance/referrals/adm",
    });
  }
  if (bookedCounseling > 0) {
    recommendations.push({
      key: "sessions-counseling",
      title: `Finish or reschedule ${bookedCounseling} booked counseling session${bookedCounseling === 1 ? "" : "s"}`,
      detail: "Counseling cases with upcoming sessions can't move until the session is done or moved.",
      count: bookedCounseling,
      href: "/guidance/referrals/counseling",
    });
  }
  if (followAdm > 0) {
    recommendations.push({
      key: "followup-adm",
      title: `Check back on ${followAdm} ADM follow-up${followAdm === 1 ? "" : "s"}`,
      detail: "Their follow-up dates are approaching or due.",
      count: followAdm,
      href: "/guidance/referrals/adm",
    });
  }
  if (followCounseling > 0) {
    recommendations.push({
      key: "followup-counseling",
      title: `Check back on ${followCounseling} counseling follow-up${followCounseling === 1 ? "" : "s"}`,
      detail: "Their follow-up dates are approaching or due.",
      count: followCounseling,
      href: "/guidance/referrals/counseling",
    });
  }
  if (highRisk > 0) {
    recommendations.push({
      key: "risk",
      title: `Prioritize ${highRisk} high-risk student${highRisk === 1 ? "" : "s"}`,
      detail: "The risk engine flags these cases as High — review them first in their timelines.",
      count: highRisk,
      href: null,
    });
  }
  if (staleAdm > 0) {
    recommendations.push({
      key: "stale-adm",
      title: `${staleAdm} ADM case${staleAdm === 1 ? "" : "s"} waiting over ${BOTTLENECK_DAYS} days`,
      detail: "These are the bottleneck — decide them before newer arrivals.",
      count: staleAdm,
      href: "/guidance/referrals/adm",
    });
  }
  if (staleCounseling > 0) {
    recommendations.push({
      key: "stale-counseling",
      title: `${staleCounseling} counseling case${staleCounseling === 1 ? "" : "s"} waiting over ${BOTTLENECK_DAYS} days`,
      detail: "These are the bottleneck — handle them before newer arrivals.",
      count: staleCounseling,
      href: "/guidance/referrals/counseling",
    });
  }

  const handledMs = rows
    .map((r) => firstHandlingMs(r))
    .filter((ms): ms is number => typeof ms === "number" && Number.isFinite(ms));
  const response: GuidanceAdmResponseStats = {
    longestDays: handledMs.length === 0 ? null : Math.max(...handledMs) / DAY_MS,
    avgDays:
      handledMs.length === 0
        ? null
        : handledMs.reduce((sum, ms) => sum + ms, 0) / handledMs.length / DAY_MS,
    measured: handledMs.length,
  };

  return { total, findings, categories, bottlenecks, recommendations, response };
}
