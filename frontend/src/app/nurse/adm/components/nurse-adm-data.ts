import { deriveActionStatus } from "@/services/nurse/labels";
import type {
  NurseAlertItem,
  NurseRiskLevel,
} from "../../alerts/components/nurse-alerts-data";

export interface NurseAdmActionCount {
  action: string;
  label: string;
  count: number;
}

export interface NurseAdmTrendWeek {
  week: string;
  label: string;
  count: number;
}

export interface NurseAdmReferralsData {
  total: number;
  actions: NurseAdmActionCount[];
  trend: NurseAdmTrendWeek[];
  /* Latest ADM cases referred to the nurse, newest referred first —
     every state, so the queue always reflects the desk. Alerts (not
     bare rows) so the table can read latest actions and risk ids. */
  queue: NurseAlertItem[];
  /* Every referral on the nurse's desk (clinic + ADM), newest referred
     first, every status — reports and insights read this so the whole
     desk is counted, not just the ADM review queue. */
  desk: NurseAlertItem[];
}

const DAY_MS = 86_400_000;
const TREND_WEEKS = 12;

/* Known action states first (same order as the overview charts), anything
   else after — so the donut legend never jumps around. */
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

function referredTimeMs(value: string): number {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function shortLabel(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

/**
 * Referrals report for the nurse's desk — derived from the desk-wide case
 * list (clinic + ADM, every status: pending through dismissed), NOT the
 * action-scoped alerts feed, so terminal rows are counted too and reports
 * always reflect the current referrals whatever their status. The review
 * `queue` stays ADM-only (its endorse/forward actions are ADM-specific);
 * actions, trend, and `desk` cover the whole desk. Mirrors the guidance
 * ADM referrals shape (action breakdown + trend + review queue) with the
 * nurse action vocabulary.
 */
export function buildNurseAdmReferrals(items: NurseAlertItem[]): NurseAdmReferralsData {
  const seen = new Map<string, NurseAlertItem>();
  const seenAdm = new Map<string, NurseAlertItem>();
  for (const a of items) {
    if (!seen.has(a.row.id)) seen.set(a.row.id, a);
    if (a.row.type !== "ADM") continue;
    if (!seenAdm.has(a.row.id)) seenAdm.set(a.row.id, a);
  }
  const byReferredDesc = (a: NurseAlertItem, b: NurseAlertItem) =>
    referredTimeMs(b.row.referredAt) - referredTimeMs(a.row.referredAt);
  const queue = [...seenAdm.values()].sort(byReferredDesc);
  const desk = [...seen.values()].sort(byReferredDesc);
  const rows = desk.map((a) => a.row);

  const counts = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    const action = deriveActionStatus(row.type, row.status, row.sessions);
    // Finished clinic sessions read as Done — same bucket the overview
    // charts use.
    const key = action.key === "done_session" ? "done" : action.key;
    const label = key === "done" ? "Done" : action.label;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { label, count: 1 });
  }
  const actions = [...counts.entries()]
    .map(([action, { label, count }]) => ({ action, label, count }))
    .sort(
      (a, b) =>
        actionRank(a.action) - actionRank(b.action) || b.count - a.count
    );

  // Weekly referral trend over the trailing 12 weeks, oldest first.
  const nowMs = Date.now();
  const trend: NurseAdmTrendWeek[] = [];
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
  for (const row of rows) {
    const t = new Date(row.referredAt).getTime();
    if (!Number.isFinite(t)) continue;
    const ageWeeks = Math.floor((nowMs - t) / (7 * DAY_MS));
    if (ageWeeks < 0 || ageWeeks >= TREND_WEEKS) continue;
    const idx = trend.length - 1 - ageWeeks;
    if (idx >= 0 && idx < trend.length) trend[idx].count += 1;
  }

  // Latest cases per surface, newest referred first — every state
  // (pending, endorsed, follow-up, done), so each section always reflects
  // the desk.
  return { total: rows.length, actions, trend, queue, desk };
}

export interface NurseAdmFinding {
  key: string;
  label: string;
  value: string;
  hint: string;
}

export interface NurseAdmCategorySlice {
  key: string;
  label: string;
  count: number;
  share: number;
}

export interface NurseAdmBottleneck {
  id: string;
  student: string;
  section: string;
  kind: string;
  waitingDays: number;
  reason: string;
}

export interface NurseAdmRecommendation {
  key: string;
  title: string;
  detail: string;
  count: number;
  href: string | null;
}

export interface NurseAdmResponseStats {
  /** Longest nurse response across measured cases, in days. */
  longestDays: number | null;
  /** Mean nurse response across measured cases, in days. */
  avgDays: number | null;
  /** Cases with a measurable first handling action. */
  measured: number;
}

export interface NurseAdmInsightsData {
  total: number;
  findings: NurseAdmFinding[];
  categories: NurseAdmCategorySlice[];
  bottlenecks: NurseAdmBottleneck[];
  recommendations: NurseAdmRecommendation[];
  response: NurseAdmResponseStats;
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

/* First nurse handling per case, in ms after referral — earliest booked
   session wins (booking is handling); otherwise the latest recorded action
   when the case visibly moved. Untouched pendings and dismissed cases with
   no session trail measure nothing (an adviser withdrawal looks identical
   to a nurse rejection in this payload), so they stay out of the average. */
function firstHandlingMs(row: {
  referredAt: string;
  status: string;
  sessions: { createdAt?: string | null }[];
  lastActionAt?: string | null;
}): number | null {
  const referred = new Date(row.referredAt).getTime();
  if (!Number.isFinite(referred)) return null;
  const bookings = row.sessions
    .map((s) => new Date(s.createdAt ?? "").getTime())
    .filter((t) => Number.isFinite(t) && t >= referred);
  if (bookings.length > 0) return Math.min(...bookings) - referred;
  if (row.status !== "pending") {
    const t = new Date(row.lastActionAt ?? "").getTime();
    if (Number.isFinite(t) && t >= referred) return t - referred;
  }
  return null;
}

const BOTTLENECK_DAYS = 7;
const BOTTLENECK_TOP = 5;

/**
 * Referral insights over the nurse's whole desk (clinic + ADM) — key
 * findings, category mix, waiting bottlenecks, and rule-based
 * recommendations. Pure derivation from the same desk list the reports
 * read, so insights, charts, and rows can never disagree. Counts derive
 * from live rows only, never mocks.
 */
export function buildNurseAdmInsights(
  items: NurseAlertItem[],
  riskByStudent: Record<string, NurseRiskLevel> = {},
): NurseAdmInsightsData {
  const queue = items;
  const rows = queue.map((a) => a.row);
  const total = rows.length;
  const pending = rows.filter((r) => r.status === "pending");
  const admPending = pending.filter((r) => r.type === "ADM").length;
  const clinicPending = pending.length - admPending;
  const waits = pending
    .map((r) => r.waitingDays)
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d));
  const avgWaiting =
    waits.length === 0
      ? null
      : waits.reduce((sum, d) => sum + d, 0) / waits.length;
  const endorsed = rows.filter(
    (r) => deriveActionStatus(r.type, r.status, r.sessions).key === "endorsed",
  ).length;
  const rejected = rows.filter(
    (r) =>
      r.type === "ADM" &&
      deriveActionStatus(r.type, r.status, r.sessions).key === "rejected",
  ).length;
  const decided = endorsed + rejected;
  const endorsementRate = decided === 0 ? null : Math.round((endorsed / decided) * 100);

  const findings: NurseAdmFinding[] = [
    {
      key: "total",
      label: "Referrals on your desk",
      value: String(total),
      hint:
        total === 0
          ? "No referrals on your desk yet."
          : `${pending.length} needing action.`,
    },
    {
      key: "awaiting",
      label: "Awaiting action",
      value: String(pending.length),
      hint:
        pending.length === 0
          ? "Every case has a decision."
          : `${admPending} ADM · ${clinicPending} clinic.`,
    },
    {
      key: "waiting",
      label: "Avg. waiting time",
      value: avgWaiting === null ? "—" : `${avgWaiting.toFixed(1)}d`,
      hint:
        avgWaiting === null
          ? "No pending cases to measure."
          : "Across cases still waiting.",
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
    .filter((r) => typeof r.waitingDays === "number" && Number.isFinite(r.waitingDays))
    .sort((a, b) => (b.waitingDays ?? 0) - (a.waitingDays ?? 0))
    .slice(0, BOTTLENECK_TOP)
    .map((r) => ({
      id: r.id,
      student: r.student || "Unknown student",
      section: r.section || "",
      kind: r.type || "",
      waitingDays: r.waitingDays ?? 0,
      reason: r.reason || "",
    }));

  // Every count below is track-split so it links to the list that shows
  // exactly those rows (ADM → review queue anchor, clinic → clinic
  // timeline). The referral form exists only on the ADM track — clinic
  // pendings must never count as form-blocked.
  const isAdm = (r: { type: string }) => r.type === "ADM";
  const formBlocked = pending.filter((r) => isAdm(r) && !r.referralReady).length;
  const bookedAdm = rows.filter(
    (r) => isAdm(r) && r.sessions.some((s) => s.status === "scheduled"),
  ).length;
  const bookedClinic = rows.filter(
    (r) => !isAdm(r) && r.sessions.some((s) => s.status === "scheduled"),
  ).length;
  const followAdm = rows.filter((r) => isAdm(r) && r.status === "follow_up").length;
  const followClinic = rows.filter((r) => !isAdm(r) && r.status === "follow_up").length;
  const highRisk = queue.filter(
    (a) => a.studentId && riskByStudent[a.studentId] === "High",
  ).length;
  const staleAdm = pending.filter(
    (r) =>
      isAdm(r) &&
      typeof r.waitingDays === "number" &&
      r.waitingDays > BOTTLENECK_DAYS,
  ).length;
  const staleClinic = pending.filter(
    (r) =>
      !isAdm(r) &&
      typeof r.waitingDays === "number" &&
      r.waitingDays > BOTTLENECK_DAYS,
  ).length;

  const recommendations: NurseAdmRecommendation[] = [];
  if (admPending > 0) {
    recommendations.push({
      key: "review",
      title: `Review ${admPending} ADM case${admPending === 1 ? "" : "s"} awaiting consultation`,
      detail: "Endorse or reject them from the ADM timeline to keep the pipeline moving.",
      count: admPending,
      href: "/nurse/referrals/adm",
    });
  }
  if (clinicPending > 0) {
    recommendations.push({
      key: "clinic",
      title: `Start handling ${clinicPending} clinic matter${clinicPending === 1 ? "" : "s"}`,
      detail: "Accept them from the Clinic Matters timeline to begin care.",
      count: clinicPending,
      href: "/nurse/referrals/clinic",
    });
  }
  if (formBlocked > 0) {
    recommendations.push({
      key: "form",
      title: `Complete the referral form on ${formBlocked} case${formBlocked === 1 ? "" : "s"}`,
      detail: "Forwarding to the ADM coordinator unlocks only once the form is done.",
      count: formBlocked,
      href: "/nurse/referrals/adm",
    });
  }
  if (bookedAdm > 0) {
    recommendations.push({
      key: "sessions-adm",
      title: `Finish or reschedule ${bookedAdm} booked ADM session${bookedAdm === 1 ? "" : "s"}`,
      detail: "ADM cases with upcoming sessions can't move until the session is done or moved.",
      count: bookedAdm,
      href: "/nurse/referrals/adm",
    });
  }
  if (bookedClinic > 0) {
    recommendations.push({
      key: "sessions-clinic",
      title: `Finish or reschedule ${bookedClinic} booked clinic session${bookedClinic === 1 ? "" : "s"}`,
      detail: "Clinic cases with upcoming sessions can't move until the session is done or moved.",
      count: bookedClinic,
      href: "/nurse/referrals/clinic",
    });
  }
  if (followAdm > 0) {
    recommendations.push({
      key: "followup-adm",
      title: `Check back on ${followAdm} ADM follow-up${followAdm === 1 ? "" : "s"}`,
      detail: "Their follow-up dates are approaching or due.",
      count: followAdm,
      href: "/nurse/referrals/adm",
    });
  }
  if (followClinic > 0) {
    recommendations.push({
      key: "followup-clinic",
      title: `Check back on ${followClinic} clinic follow-up${followClinic === 1 ? "" : "s"}`,
      detail: "Their follow-up dates are approaching or due.",
      count: followClinic,
      href: "/nurse/referrals/clinic",
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
      href: "/nurse/referrals/adm",
    });
  }
  if (staleClinic > 0) {
    recommendations.push({
      key: "stale-clinic",
      title: `${staleClinic} clinic case${staleClinic === 1 ? "" : "s"} waiting over ${BOTTLENECK_DAYS} days`,
      detail: "These are the bottleneck — handle them before newer arrivals.",
      count: staleClinic,
      href: "/nurse/referrals/clinic",
    });
  }

  const handledMs = rows
    .map((r) => firstHandlingMs(r))
    .filter((ms): ms is number => typeof ms === "number" && Number.isFinite(ms));
  const response: NurseAdmResponseStats = {
    longestDays:
      handledMs.length === 0 ? null : Math.max(...handledMs) / DAY_MS,
    avgDays:
      handledMs.length === 0
        ? null
        : handledMs.reduce((sum, ms) => sum + ms, 0) / handledMs.length / DAY_MS,
    measured: handledMs.length,
  };

  return { total, findings, categories, bottlenecks, recommendations, response };
}
