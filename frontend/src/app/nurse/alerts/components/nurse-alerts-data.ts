import { apiClient } from "@/lib/api/client";
import {
  isNurseScope,
  toQueueRow,
  type NurseQueueRow,
  type RawReferral,
} from "../../overview/components/nurse-overview-data";

export type NurseAlertSeverity = "urgent" | "new" | "info" | "done";

// Live rule-based risk level from the risk engine (High/Moderate/Low).
// Null when the student has no account-backed profile (roster-only) or the
// lookup failed — the table renders "—" for those rows.
export type NurseRiskLevel = "High" | "Moderate" | "Low";

export interface NurseAlertItem {
  key: string;
  severity: NurseAlertSeverity;
  title: string;
  detail: string;
  // One-line waiting / due / resolved line for the card bullets.
  waiting: string;
  date: string;
  sortTime: number;
  // Account userId (or roster id for enlisted students without accounts)
  // for the live risk lookup. The endpoint serves both, so every referred
  // student resolves a level instead of "—".
  studentId: string | null;
  row: NurseQueueRow;
}

export interface NurseNotificationItem {
  id: string;
  label: string;
  message: string;
  date: string;
  isRead: boolean;
}

export interface NurseAlertsSummary {
  urgent: number;
  fresh: number;
  followUps: number;
  resolvedWeek: number;
  total: number;
}

export interface NurseAlertsData {
  summary: NurseAlertsSummary;
  alerts: NurseAlertItem[];
  notifications: NurseNotificationItem[];
  unread: number;
}

export const NURSE_SEVERITY_LABELS: Record<NurseAlertSeverity, string> = {
  urgent: "Urgent",
  new: "New",
  info: "Info",
  done: "Resolved",
};

const DAY_MS = 86_400_000;
const RESOLVED_WINDOW_MS = 7 * DAY_MS;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDay(value: string | null | undefined): string {
  const d = parseDate(value);
  return d ? d.toISOString().slice(0, 10) : "—";
}

function prettifyType(raw: string | null | undefined): string {
  if (!raw) return "Notice";
  const words = raw.replace(/^generic_/, "").split("_").filter(Boolean);
  if (words.length === 0) return "Notice";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface RawNotification {
  id: string;
  type?: string | null;
  message?: string | null;
  isRead?: boolean | null;
  createdAt?: string | null;
}

function toNotificationItem(n: RawNotification): NurseNotificationItem {
  return {
    id: n.id,
    label: prettifyType(n.type),
    message: n.message?.trim() || "No details provided.",
    date: isoDay(n.createdAt),
    isRead: n.isRead ?? false,
  };
}

const SEVERITY_RANK: Record<NurseAlertSeverity, number> = {
  urgent: 0,
  new: 1,
  info: 2,
  done: 3,
};

// Every alert derives from live backend rows: nurse-scope referrals plus
// the nurse's own notification inbox. Nothing here is mocked.
export function buildNurseAlerts(
  referrals: RawReferral[],
  notifications: RawNotification[],
  now: Date = new Date(),
): NurseAlertsData {
  const scoped = referrals.filter(isNurseScope);
  const alerts: NurseAlertItem[] = [];

  const waitingLine = (days: number | null, prefix = ""): string => {
    const wait = days === null || days <= 0 ? "Referred today" : `${days}d waiting`;
    return prefix ? `${prefix} · ${wait}` : wait;
  };

  for (const r of scoped) {
    const row = toQueueRow(r);
    // Account userId for the live risk lookup (GET /api/risk/students/:id),
    // falling back to the roster id for enlisted students without accounts
    // (the endpoint evaluates those live too).
    const studentId = r.student?.userId ?? r.roster?.id ?? null;
    const status = r.status ?? "pending";
    const timeOf = (iso: string | null | undefined) => parseDate(iso)?.getTime() ?? 0;

    if (status === "escalated" && r.escalatedTo === "nurse") {
      alerts.push({
        key: `${r.id}:escalated`,
        severity: "urgent",
        title: "Escalated to you",
        detail: row.reason,
        waiting: waitingLine(row.waitingDays, "Escalated"),
        date: row.date,
        sortTime: timeOf(r.referredAt),
        studentId,
        row,
      });
      continue;
    }

    if (status === "pending") {
      // ADM cases whose referral form is completed wait on the explicit
      // Endorse & forward click — they never auto-pass to the coordinator.
      const readyToForward = row.type === "ADM" && row.referralReady;
      alerts.push({
        key: `${r.id}:pending`,
        severity: "new",
        title: readyToForward ? "Referral ready — forward" : "Needs review",
        detail: row.reason,
        waiting: waitingLine(row.waitingDays),
        date: row.date,
        sortTime: timeOf(r.referredAt),
        studentId,
        row,
      });
    }

    if (status === "info_requested") {
      alerts.push({
        key: `${r.id}:info`,
        severity: "info",
        title: "Waiting on information",
        detail: row.reason,
        waiting: waitingLine(row.waitingDays),
        date: row.date,
        sortTime: timeOf(r.referredAt),
        studentId,
        row,
      });
    }

    if (status === "follow_up" || status === "in_progress") {
      const due = parseDate(r.followUpDate);
      const overdue = due !== null && due <= now;
      const dueDay = due ? due.toISOString().slice(0, 10) : null;
      const waiting = !due
        ? waitingLine(row.waitingDays)
        : overdue
          ? `Due ${dueDay} · ${Math.max(0, Math.floor((now.getTime() - due.getTime()) / DAY_MS))}d overdue`
          : `Due ${dueDay}`;
      alerts.push({
        key: `${r.id}:followup`,
        severity: overdue ? "urgent" : "info",
        title: overdue ? "Follow-up overdue" : "Marked for follow-up",
        detail: row.reason,
        waiting,
        date: row.date,
        // Most overdue (smallest due date) floats to the top.
        sortTime: due ? due.getTime() : timeOf(r.referredAt),
        studentId,
        row,
      });
    }

    if (status === "resolved") {
      const resolvedAt = parseDate(r.resolvedAt);
      if (resolvedAt && now.getTime() - resolvedAt.getTime() <= RESOLVED_WINDOW_MS) {
        alerts.push({
          key: `${r.id}:resolved`,
          severity: "done",
          title: "Resolved this week",
          detail: row.reason,
          waiting: `Resolved ${resolvedAt.toISOString().slice(0, 10)}`,
          date: resolvedAt.toISOString().slice(0, 10),
          // Negated so the most recently resolved surfaces first.
          sortTime: -resolvedAt.getTime(),
          studentId,
          row,
        });
      }
    }
  }

  // Oldest referral activity first within a severity (longest waiting on
  // top, like the overview queue); most recently resolved first among done.
  alerts.sort((a, b) => {
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rank !== 0) return rank;
    return a.sortTime - b.sortTime;
  });

  const items = notifications.map(toNotificationItem);
  const summary: NurseAlertsSummary = {
    urgent: alerts.filter((a) => a.severity === "urgent").length,
    fresh: alerts.filter((a) => a.severity === "new").length,
    followUps: alerts.filter((a) => a.key.endsWith(":followup")).length,
    resolvedWeek: alerts.filter((a) => a.severity === "done").length,
    total: alerts.length,
  };

  return {
    summary,
    alerts,
    notifications: items,
    unread: items.filter((n) => !n.isRead).length,
  };
}

export async function fetchNurseAlerts(): Promise<NurseAlertsData> {
  const [referralsRes, notificationsRes] = await Promise.all([
    apiClient.get<RawReferral[] | { referrals: RawReferral[] }>("/api/referrals/"),
    apiClient.get<RawNotification[]>("/api/notifications/"),
  ]);
  const referrals = Array.isArray(referralsRes.data)
    ? referralsRes.data
    : (referralsRes.data?.referrals ?? []);
  const notifications = Array.isArray(notificationsRes.data) ? notificationsRes.data : [];
  return buildNurseAlerts(referrals, notifications);
}

export async function markNurseNotificationRead(id: string): Promise<void> {
  await apiClient.post(`/api/notifications/read/${id}`);
}

export async function markAllNurseNotificationsRead(): Promise<void> {
  await apiClient.post("/api/notifications/read-all");
}

// Live rule-based risk level per referred student — single batched call
// (GET /api/risk/students/batch?ids=…) replacing the old per-student N+1
// fan-out. Falls back to per-id requests only if the batch endpoint is
// unavailable (transitional). Ids with no result stay absent (table "—").
export async function fetchNurseRiskLevels(
  studentIds: string[]
): Promise<Record<string, NurseRiskLevel>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const isLevel = (v: unknown): v is NurseRiskLevel =>
    v === "High" || v === "Moderate" || v === "Low";
  try {
    const { data } = await apiClient.get<{ levels: Record<string, string> }>(
      "/api/risk/students/batch",
      { params: { ids: unique.join(",") } }
    );
    const map: Record<string, NurseRiskLevel> = {};
    for (const [id, level] of Object.entries(data?.levels ?? {})) {
      if (isLevel(level)) map[id] = level;
    }
    return map;
  } catch {
    // Transitional fallback — one failure never blocks the rest.
    const settled = await Promise.allSettled(
      unique.map(async (id) => {
        const { data } = await apiClient.get<{ lrn: string; riskLevel: NurseRiskLevel }>(
          `/api/risk/students/${id}`
        );
        return { id, riskLevel: data?.riskLevel ?? null };
      })
    );
    const map: Record<string, NurseRiskLevel> = {};
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value.riskLevel !== null && isLevel(s.value.riskLevel)) {
        map[s.value.id] = s.value.riskLevel;
      }
    }
    return map;
  }
}
