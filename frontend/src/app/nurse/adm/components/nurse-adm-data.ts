import { deriveActionStatus } from "../../overview/components/nurse-overview-data";
import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";

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
 * ADM referrals on the nurse's desk — derived from the same
 * nurse-scope alerts feed as the ADM Cases timeline, so the reports
 * and the timeline can never disagree. Mirrors the guidance ADM
 * referrals shape (action breakdown + trend + review queue) with the
 * nurse action vocabulary.
 */
export function buildNurseAdmReferrals(alerts: NurseAlertItem[]): NurseAdmReferralsData {
  const seen = new Map<string, NurseAlertItem>();
  for (const a of alerts) {
    if (a.row.type !== "ADM") continue;
    if (!seen.has(a.row.id)) seen.set(a.row.id, a);
  }
  const queue = [...seen.values()].sort(
    (a, b) => referredTimeMs(b.row.referredAt) - referredTimeMs(a.row.referredAt)
  );
  const rows = queue.map((a) => a.row);

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

  // Latest ADM cases referred to the nurse, newest referred first —
  // every state (pending, endorsed, follow-up, done), so the section
  // always reflects the desk.
  return { total: rows.length, actions, trend, queue };
}
