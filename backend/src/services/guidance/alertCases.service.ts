import { INTERNAL_AGGREGATE_ROW_CAP } from "../../lib/pagination.js";
import { listQueue as listInterventionQueue } from "../interventions/queues.service.js";
import { getCases } from "./cases.service.js";
import type { GuidanceContext } from "./guidance.types.js";

/**
 * The alerts desk is one board built from two desks (guidance referrals +
 * the live intervention cohort). It used to be assembled in the browser by
 * fetching up to ten pages of each source, which made the backend recompute
 * the whole live cohort ten times per visit. Merge both sources here, once,
 * and page the merged board server-side.
 */

export type AlertCaseType = "" | "ADM" | "Counseling" | "Intervention";
export type AlertCaseRisk = "" | "High" | "Moderate" | "Low";

export interface AlertCasesQuery {
  type: AlertCaseType;
  risk: AlertCaseRisk;
  q: string;
  page: number;
  pageSize: number;
}

type RawReferral = Record<string, any> & {
  id: string;
  student: string;
  lrn: string;
  section: string;
  studentId: string | null;
  type: string;
  reason: string;
  category: string;
};

type RawIntervention = Record<string, any> & {
  studentKey: string;
  student: string;
  lrn: string;
  section: string;
  riskLevel: string;
  detectedAt: string | null;
  intervention: Record<string, any> | null;
};

export type AlertCaseRow =
  | { kind: "referral"; referral: RawReferral }
  | { kind: "intervention"; item: RawIntervention };

const TYPE_OF = (row: AlertCaseRow): Exclude<AlertCaseType, ""> =>
  row.kind === "referral" ? (row.referral.type === "ADM" ? "ADM" : "Counseling") : "Intervention";

const SEARCH_TEXT_OF = (row: AlertCaseRow): string =>
  row.kind === "referral"
    ? `${row.referral.student} ${row.referral.lrn} ${row.referral.section} ${row.referral.reason} ${row.referral.category}`
    : `${row.item.student} ${row.item.lrn} ${row.item.section} ${
        row.item.intervention?.recommendedAction ?? ""
      } ${row.item.intervention?.assignee ?? ""}`;

function toMs(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Latest activity timestamp, mirroring the board's "most recent action" sort. */
function actionTimeOf(row: AlertCaseRow): number | null {
  const stamps: (string | null | undefined)[] = [];
  if (row.kind === "referral") {
    const r = row.referral;
    stamps.push(r.lastActionAt, r.followUpDate, r.acceptedAt, r.date);
    for (const session of (r.sessions ?? []) as Record<string, any>[]) {
      stamps.push(session.completedAt || session.createdAt || session.scheduledAt);
    }
  } else {
    const item = row.item;
    stamps.push(item.detectedAt);
    stamps.push(item.intervention?.createdAt ?? null);
    for (const session of (item.intervention?.sessions ?? []) as Record<string, any>[]) {
      stamps.push(session.completedAt || session.createdAt || session.scheduledAt);
    }
  }
  let newest: number | null = null;
  for (const stamp of stamps) {
    const t = toMs(stamp);
    if (t !== null && (newest === null || t > newest)) newest = t;
  }
  return newest;
}

export async function getAlertCases(ctx: GuidanceContext, query: AlertCasesQuery) {
  const pageSize = Math.min(Math.max(1, Math.floor(query.pageSize) || 15), 15);
  const needle = query.q.trim().toLowerCase();

  const [referralsResult, interventionsResult] = await Promise.all([
    getCases(
      { userId: ctx.userId, role: ctx.role, termId: ctx.termId, schoolYearId: null },
      {
        statusFilter: null,
        q: "",
        typeFilter: null,
        bookedFilter: false,
        completedFilter: false,
        openFilter: false,
        page: 1,
        pageSize: INTERNAL_AGGREGATE_ROW_CAP,
        highlight: "",
        internalPageCap: INTERNAL_AGGREGATE_ROW_CAP,
      },
    ),
    listInterventionQueue(
      { userId: ctx.userId, role: ctx.role, termId: ctx.termId },
      {
        level: "All",
        factor: null,
        mineOnly: false,
        outcome: "all",
        q: "",
        page: 1,
        pageSize: INTERNAL_AGGREGATE_ROW_CAP,
        unbounded: true,
      },
      { termId: ctx.termId, schoolYearId: ctx.schoolYearId },
    ),
  ]);

  const referralRows = (referralsResult.referrals ?? []) as unknown as RawReferral[];
  const interventionRows = (interventionsResult.students ?? []) as unknown as RawIntervention[];

  // Risk levels come from the live cohort, so every row is graded — not just
  // the first fifteen student ids the old client-side batch call could cover.
  const riskByStudent: Record<string, string> = {};
  for (const item of interventionRows) {
    riskByStudent[item.studentKey] = item.riskLevel;
    if (item.studentKey.startsWith("roster:")) {
      riskByStudent[item.studentKey.slice("roster:".length)] = item.riskLevel;
    }
  }

  const riskOf = (row: AlertCaseRow): AlertCaseRisk => {
    const level =
      row.kind === "referral"
        ? (row.referral.studentId ? riskByStudent[row.referral.studentId] : undefined)
        : row.item.riskLevel;
    return level === "High" || level === "Moderate" || level === "Low" ? level : "";
  };

  const allRows: AlertCaseRow[] = [
    ...referralRows.map((referral) => ({ kind: "referral" as const, referral })),
    ...interventionRows.map((item) => ({ kind: "intervention" as const, item })),
  ];
  // Low-risk cases are not actionable on this desk — same rule the board used
  // client-side, now applied before counting and paging.
  const boardRows = allRows.filter((row) => riskOf(row) !== "Low");

  const countBy = (predicate: (row: AlertCaseRow) => boolean) => boardRows.filter(predicate).length;

  const seen = new Set<string>();
  const urgent: { student: string; lrn: string; kind: "referral" | "intervention"; id: string; track: "adm" | "counseling" | "intervention" }[] = [];
  for (const row of boardRows) {
    if (riskOf(row) !== "High") continue;
    const student = row.kind === "referral" ? row.referral.student : row.item.student;
    const lrn = row.kind === "referral" ? row.referral.lrn : row.item.lrn;
    const key = `${student.trim().toLowerCase()}|${lrn.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    urgent.push({
      student,
      lrn,
      kind: row.kind,
      id: row.kind === "referral" ? row.referral.id : row.item.studentKey,
      track:
        row.kind === "referral"
          ? row.referral.type === "ADM"
            ? "adm"
            : "counseling"
          : "intervention",
    });
  }

  const latestDetected = interventionRows
    .filter((item) => item.riskLevel !== "Low")
    .sort((a, b) => (toMs(b.detectedAt) ?? -1) - (toMs(a.detectedAt) ?? -1));
  const detectedTotal = latestDetected.length;

  const summary = {
    total: boardRows.length,
    high: countBy((row) => riskOf(row) === "High"),
    moderate: countBy((row) => riskOf(row) === "Moderate"),
    adm: countBy((row) => TYPE_OF(row) === "ADM"),
    counseling: countBy((row) => TYPE_OF(row) === "Counseling"),
    intervention: countBy((row) => TYPE_OF(row) === "Intervention"),
    detected: detectedTotal,
    latestDetected: latestDetected.slice(0, 6).map((item) => ({
      studentKey: item.studentKey,
      student: item.student,
      lrn: item.lrn,
      riskLevel: item.riskLevel,
      detectedAt: item.detectedAt,
    })),
    urgentCount: urgent.length,
    urgent: urgent.slice(0, 6),
  };

  const filtered = boardRows.filter((row) => {
    if (query.type && TYPE_OF(row) !== query.type) return false;
    if (query.risk && riskOf(row) !== query.risk) return false;
    if (needle && !SEARCH_TEXT_OF(row).toLowerCase().includes(needle)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const at = actionTimeOf(a);
    const bt = actionTimeOf(b);
    if (at === null && bt === null) return 0;
    if (at === null) return 1;
    if (bt === null) return -1;
    return bt - at;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, query.page), totalPages);
  const cases = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    cases,
    riskByStudent,
    summary,
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}
