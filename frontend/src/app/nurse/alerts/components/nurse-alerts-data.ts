import { apiClient } from "@/lib/api/client";
import {
  deriveActionStatus,
  isNurseScope,
  toQueueRow,
} from "@/services/nurse/labels";
import type {
  NurseQueueRow,
  RawReferral,
} from "@/services/nurse/nurse.types";

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
  closed: number;
  total: number;
}

export interface NurseAlertsData {
  summary: NurseAlertsSummary;
  alerts: NurseAlertItem[];
  // Every nurse-scope referral in EVERY status (pending through dismissed),
  // one item per case — desk-wide insights read this list. The `alerts`
  // feed carries the same rows with action-oriented titles, so nothing
  // ever disappears from the desk unless the nurse deletes the case.
  cases: NurseAlertItem[];
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

  // Desk-wide case list (every status) alongside the action-scoped
  // alerts below — insights and review queues read `cases` so dismissed
  // and older resolved referrals are counted too.
  const cases: NurseAlertItem[] = [];

  for (const r of scoped) {
    const row = toQueueRow(r);
    // Account userId for the live risk lookup (GET /api/risk/students/:id),
    // falling back to the roster id for enlisted students without accounts
    // (the endpoint evaluates those live too).
    const studentId = r.student?.userId ?? r.roster?.id ?? null;
    const status = r.status ?? "pending";
    const timeOf = (iso: string | null | undefined) => parseDate(iso)?.getTime() ?? 0;

    cases.push({
      key: r.id,
      severity: status === "resolved" || status === "dismissed" ? "done" : "info",
      title: deriveActionStatus(row.type, status, row.sessions).label,
      detail: row.reason,
      waiting: waitingLine(row.waitingDays),
      date: row.date,
      sortTime: timeOf(r.referredAt),
      studentId,
      row,
    });

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

    // Resolved cases stay on the desk at any age — nothing is removed
    // unless the nurse deletes the case. Recent ones keep the weekly title.
    if (status === "resolved") {
      const resolvedAt = parseDate(r.resolvedAt);
      const resolvedDay = resolvedAt ? resolvedAt.toISOString().slice(0, 10) : row.date;
      const recent =
        resolvedAt !== null && now.getTime() - resolvedAt.getTime() <= RESOLVED_WINDOW_MS;
      alerts.push({
        key: `${r.id}:resolved`,
        severity: "done",
        title: recent ? "Resolved this week" : "Resolved",
        detail: row.reason,
        waiting: `Resolved ${resolvedDay}`,
        date: resolvedDay,
        // Negated so the most recently resolved surfaces first.
        sortTime: resolvedAt ? -resolvedAt.getTime() : -timeOf(r.referredAt),
        studentId,
        row,
      });
    }

    // Dismissed/closed cases stay visible too — the list only shrinks when
    // the nurse deletes a case, never on status change.
    if (status === "dismissed") {
      alerts.push({
        key: `${r.id}:dismissed`,
        severity: "done",
        title: "Closed",
        detail: row.reason,
        waiting: "Closed",
        date: row.date,
        // No closure timestamp on the payload — newest referred first.
        sortTime: -timeOf(r.referredAt),
        studentId,
        row,
      });
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
    resolvedWeek: alerts.filter(
      (a) => a.key.endsWith(":resolved") && a.title === "Resolved this week",
    ).length,
    closed: alerts.filter((a) => a.key.endsWith(":dismissed")).length,
    total: alerts.length,
  };

  return {
    summary,
    alerts,
    cases,
    notifications: items,
    unread: items.filter((n) => !n.isRead).length,
  };
}

export interface NurseAlertsPageParams {
  q?: string;
  page?: number;
  pageSize?: number;
  track?: "clinic" | "adm";
  highlight?: string;
  signal?: AbortSignal;
}

export interface NurseAlertsPage extends NurseAlertsData {
  /** Filtered pager count (shrinks on search). */
  total: number;
  /** UNFILTERED desk total — tile stats never shrink on search. */
  unfilteredTotal: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

interface PaginatedReferrals {
  data?: RawReferral[];
  rows?: RawReferral[];
  referrals?: RawReferral[];
  total?: number;
  unfilteredTotal?: number;
  summary?: { total?: number; filtered?: number };
  page?: number;
  totalPages?: number;
  pageSize?: number;
  limit?: number;
}

export async function fetchNurseAlerts(
  params?: NurseAlertsPageParams
): Promise<NurseAlertsPage> {
  const query = new URLSearchParams();
  if (params?.q?.trim()) query.set("q", params.q.trim());
  query.set("page", String(Math.max(1, params?.page ?? 1)));
  query.set("pageSize", String(params?.pageSize ?? 15));
  if (params?.track) query.set("track", params.track);
  if (params?.highlight) query.set("highlight", params.highlight);
  const [referralsRes, notificationsRes] = await Promise.all([
    apiClient.get<RawReferral[] | { referrals: RawReferral[] } | PaginatedReferrals>(
      `/api/referrals/?${query.toString()}`,
      { signal: params?.signal }
    ),
    apiClient.get<RawNotification[]>("/api/notifications/"),
  ]);
  // Defensive: the endpoint has returned array, {referrals}, and paginated
  // {data/total/unfilteredTotal} shapes — never let rows.reduce crash us.
  const raw = referralsRes.data;
  const referrals: RawReferral[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as PaginatedReferrals)?.data)
      ? (raw as PaginatedReferrals).data!
      : Array.isArray((raw as PaginatedReferrals)?.rows)
        ? (raw as PaginatedReferrals).rows!
        : Array.isArray((raw as PaginatedReferrals)?.referrals)
          ? (raw as PaginatedReferrals).referrals!
          : [];
  const pager = (Array.isArray(raw) ? null : (raw as PaginatedReferrals)) ?? null;
  const notifications = Array.isArray(notificationsRes.data) ? notificationsRes.data : [];
  const built = buildNurseAlerts(referrals, notifications);
  const total = pager?.total ?? referrals.length;
  const unfilteredTotal =
    pager?.unfilteredTotal ?? pager?.summary?.total ?? referrals.length;
  const pageSize = pager?.pageSize ?? pager?.limit ?? (params?.pageSize ?? 15);
  const totalPages = pager?.totalPages ?? Math.max(1, Math.ceil(Math.max(1, total) / Math.max(1, pageSize)));
  return {
    ...built,
    total,
    unfilteredTotal,
    page: pager?.page ?? Math.max(1, params?.page ?? 1),
    totalPages,
    pageSize,
  };
}

export async function markNurseNotificationRead(id: string): Promise<void> {
  await apiClient.post(`/api/notifications/read/${id}`);
}

export async function markAllNurseNotificationsRead(): Promise<void> {
  await apiClient.post("/api/notifications/read-all");
}

// Status-only factor flags per student (same posture as levels — no
// confidential fields). Lets desks explain *why* in plain words.
export type NurseRiskFactors = {
  Academic: boolean;
  Attendance: boolean;
  Behavioral: boolean;
};

// Plain words for non-technical readers — single source of truth so every
// desk says the same thing about the same level or factor.
export const RISK_LEVEL_WORDS: Record<NurseRiskLevel, string> = {
  High: "Needs urgent attention",
  Moderate: "Keep an eye on",
  Low: "Doing okay",
};

export const RISK_FACTOR_WORDS: Record<keyof NurseRiskFactors, string> = {
  Academic: "low grades",
  Attendance: "missing classes",
  Behavioral: "behavior notes",
};

// Live factor flags per referred student — same batched endpoint as levels
// (additive `factors` map). Ids with no result stay absent. Never throws:
// an empty map simply hides the driver lines.
export async function fetchNurseRiskFactors(
  studentIds: string[]
): Promise<Record<string, NurseRiskFactors>> {
  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const { data } = await apiClient.get<{
      factors?: Record<string, Partial<NurseRiskFactors> | null>;
    }>("/api/risk/students/batch", { params: { ids: unique.join(",") } });
    const map: Record<string, NurseRiskFactors> = {};
    for (const [id, f] of Object.entries(data?.factors ?? {})) {
      map[id] = {
        Academic: f?.Academic === true,
        Attendance: f?.Attendance === true,
        Behavioral: f?.Behavioral === true,
      };
    }
    return map;
  } catch {
    return {};
  }
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
