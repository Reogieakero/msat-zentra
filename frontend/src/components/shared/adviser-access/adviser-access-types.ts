export type AccessRequestStatus = "pending" | "approved" | "denied";

export type Sf10RecordStatus = "attach" | "available" | "released";

export type Sf10RecordDetail = {
  id: string;
  source: string;
  status: Sf10RecordStatus;
  fileUrl: string | null;
  verifiedAt: string | null;
  validatedAt: string | null;
  currentVersion: number;
};

export type Sf10RecordForAdvisee = {
  lrn: string;
  name: string;
  record: Sf10RecordDetail | null;
};

export type GradeBand = "G7" | "G8" | "G9" | "G10" | "G11" | "G12";

export type AffectedAdvisee = {
  lrn: string;
  name: string;
  /** Persisted profile mascot (StudentMascot pool) — null falls back to the derived sprite. */
  mascot?: string | null;
  gradeLevel: GradeBand;
  section: string;
  sf10Status: "verified" | "validated" | "pending";
  hasAccount?: boolean;
  /** True when a filed SF10 row exists for this LRN (any status, incl. attached). */
  hasRecord?: boolean;
};

export type AdviserAccessRequest = {
  id: string;
  adviserId: string;
  adviserName: string;
  employeeId: string;
  section: string;
  gradeLevel: GradeBand;
  reason: string;
  status: AccessRequestStatus;
  decisionReason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  affectedAdvisees: AffectedAdvisee[];
  requestedLrns?: string[];
  /** Registry verification stamp — approve unlocks only after the SF10 check. */
  checkedAt?: string | null;
  /** LRNs the desk reported as missing (stored mark + adviser notice). */
  reportedMissingLrns?: string[];
  /** LRNs granted per-student access (whole-request approval grants all). */
  approvedLrns?: string[];
  /** Per-LRN grant timestamps (ISO strings) stamped on each approval. */
  approvedLrnAt?: Record<string, string>;
  summary?: { total: number; has: number; missing: number };
};

export type AccessCheckRecord = {
  lrn: string;
  name: string;
  hasAccount: boolean;
  record: {
    id: string;
    source: string;
    status: string;
    fileUrl: string | null;
    verifiedAt: string | null;
    validatedAt: string | null;
    currentVersion: number;
  } | null;
};

export type AccessCheckResult = {
  requestId: string;
  checkedAt: string;
  summary: { total: number; has: number; missing: number };
  records: AccessCheckRecord[];
};

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

/** Short calendar label for an approve timestamp ("Oct 16"). */
export function formatApproveDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface VerificationStats {
  total: number;
  has: number;
  /** Gross missing: no filed SF10 record (file truth, unaffected by Approve). */
  grossMissing: number;
  /** Missing already actioned via Report. */
  reported: number;
  /** Matched already granted via per-student Approve. */
  granted: number;
  /** Gross minus Reported: still needing Report. */
  netMissing: number;
  /** Matched still needing Approve. */
  pendingGrant: number;
}

/**
 * Shared KPI derivation for registrar + record-keeper adviser-access pages.
 * Only checked requests contribute to has/total; approve/report marks
 * never change file truth, they only move net/pending counts.
 */
export function getVerificationStats(requests: AdviserAccessRequest[]): VerificationStats {
  let has = 0;
  let total = 0;
  let reported = 0;
  let granted = 0;
  for (const r of requests) {
    reported += r.reportedMissingLrns?.length ?? 0;
    granted += r.approvedLrns?.length ?? 0;
    // Attached/Missing are check verdicts — unchecked requests are unknown.
    if (!r.checkedAt) continue;
    if (r.summary) {
      has += r.summary.has;
      total += r.summary.total;
    } else {
      total += r.affectedAdvisees.length;
      has += r.affectedAdvisees.filter((a) => a.sf10Status !== "pending").length;
    }
  }
  const grossMissing = total - has;
  return {
    total,
    has,
    grossMissing,
    reported,
    granted,
    netMissing: Math.max(0, grossMissing - reported),
    pendingGrant: Math.max(0, has - granted),
  };
}

export interface StudentListStats {
  /** Students in requests not yet checked. */
  pendingChecking: number;
  /** Students granted via dock Approve (approvedLrns). */
  approved: number;
  /** Students reported via dock Report (reportedMissingLrns). */
  reportedMissing: number;
  /** All students across the given requests. */
  totalRequested: number;
}

/**
 * KPI for the adviser-access board — pure student-list counts.
 * Pass pending requests; approve/report counts come only from dock
 * per-student actions (approvedLrns / reportedMissingLrns on success).
 */
export function getStudentListStats(requests: AdviserAccessRequest[]): StudentListStats {
  let pendingChecking = 0;
  let approved = 0;
  let reportedMissing = 0;
  let totalRequested = 0;
  for (const r of requests) {
    const n = r.affectedAdvisees.length;
    totalRequested += n;
    if (!r.checkedAt) pendingChecking += n;
    approved += r.approvedLrns?.length ?? 0;
    reportedMissing += r.reportedMissingLrns?.length ?? 0;
  }
  return { pendingChecking, approved, reportedMissing, totalRequested };
}

export type BoardStudentState = "pendingChecking" | "awaiting" | "approved" | "reported";

export interface BoardStudent {
  requestId: string;
  adviserName: string;
  section: string;
  gradeLevel: GradeBand;
  requestedAt: string;
  checkedAt?: string | null;
  lrn: string;
  name: string;
  /** Persisted profile mascot (StudentMascot pool) — null → derived sprite. */
  mascot?: string | null;
  sf10Status: AffectedAdvisee["sf10Status"];
  hasRecord?: boolean;
  state: BoardStudentState;
  /** ISO timestamp of the per-student grant (Approved cards only). */
  approvedAt?: string | null;
}

/** Flatten pending requests into student cards for the kanban board. */
export function toBoardStudents(requests: AdviserAccessRequest[]): BoardStudent[] {  const cards: BoardStudent[] = [];
  for (const r of requests) {
    const approved = new Set(r.approvedLrns ?? []);
    const reported = new Set(r.reportedMissingLrns ?? []);
    for (const a of r.affectedAdvisees) {
      const state: BoardStudentState = !r.checkedAt
        ? "pendingChecking"
        : approved.has(a.lrn)
          ? "approved"
          : reported.has(a.lrn)
            ? "reported"
            : "awaiting";
      cards.push({
        requestId: r.id,
        adviserName: r.adviserName,
        section: r.section,
        gradeLevel: r.gradeLevel,
        requestedAt: r.requestedAt,
        checkedAt: r.checkedAt,
        lrn: a.lrn,
        name: a.name,
        mascot: a.mascot ?? null,
        sf10Status: a.sf10Status,
        hasRecord: a.hasRecord,
        state,
        approvedAt: r.approvedLrnAt?.[a.lrn] ?? null,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------------
// Session-confirmed per-student marks.
//
// A list refetch that started BEFORE an Approve/Report commit can resolve
// after it and overwrite the cache with stale rows (no approvedLrns) — the
// card visibly jumps back and the user has to click again. Recording every
// server-confirmed mark here and merging it into each fetch makes confirmed
// decisions monotonic: no refetch can ever drop them.
// ---------------------------------------------------------------------------

type ConfirmedMarks = { approved: Set<string>; reported: Set<string>; approvedAt: Record<string, string> };

const confirmedMarks = new Map<string, ConfirmedMarks>();

export function recordConfirmedMarks(
  requestId: string,
  approvedLrns?: string[],
  reportedMissingLrns?: string[],
  approvedAt?: Record<string, string>,
): void {
  if (
    (!approvedLrns || approvedLrns.length === 0) &&
    (!reportedMissingLrns || reportedMissingLrns.length === 0) &&
    (!approvedAt || Object.keys(approvedAt).length === 0)
  ) {
    return;
  }
  let entry = confirmedMarks.get(requestId);
  if (!entry) {
    entry = { approved: new Set(), reported: new Set(), approvedAt: {} };
    confirmedMarks.set(requestId, entry);
  }
  for (const lrn of approvedLrns ?? []) entry.approved.add(lrn);
  for (const lrn of reportedMissingLrns ?? []) entry.reported.add(lrn);
  if (approvedAt) Object.assign(entry.approvedAt, approvedAt);
}

/** Merge session-confirmed marks into a freshly fetched request list. */
export function mergeConfirmedMarks<T extends AdviserAccessRequest>(requests: T[]): T[] {
  if (confirmedMarks.size === 0) return requests;
  let changed = false;
  const merged = requests.map((r) => {
    const entry = confirmedMarks.get(r.id);
    if (!entry) return r;
    const approvedLrns = [...new Set([...(r.approvedLrns ?? []), ...entry.approved])];
    const reportedMissingLrns = [...new Set([...(r.reportedMissingLrns ?? []), ...entry.reported])];
    const approvedLrnAt = { ...(r.approvedLrnAt ?? {}), ...entry.approvedAt };
    if (
      approvedLrns.length === (r.approvedLrns ?? []).length &&
      reportedMissingLrns.length === (r.reportedMissingLrns ?? []).length &&
      Object.keys(approvedLrnAt).length === Object.keys(r.approvedLrnAt ?? {}).length
    ) {
      return r;
    }
    changed = true;
    return { ...r, approvedLrns, reportedMissingLrns, approvedLrnAt };
  });
  return changed ? merged : requests;
}
