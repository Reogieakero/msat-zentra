"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, Megaphone, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import ThoughtLine from "@/components/ui/thought-line/ThoughtLine";
import { apiClient, getAccessToken, getActiveTermScope } from "@/lib/api/client";
import { recordConfirmedMarks } from "./adviser-access-types";

export type AdviserAccessDesk = "record-keeper" | "registrar";

// Verification trace for the ThoughtLine. Steps now advance from real SSE
// `student` events (not a fixed timer) so perceived latency matches work done.
const CHECK_STEPS = [
  "Matching advisory LRNs",
  "Reading filed SF10 records",
  "Verifying attached vs missing",
];

function isCancelError(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  const name = (e as { name?: unknown })?.name;
  return code === "ERR_CANCELED" || name === "CanceledError" || name === "AbortError";
}

function getErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response
    ?.data?.error?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

interface CheckRun {
  id: string;
  desk: AdviserAccessDesk;
  adviserName: string;
  section: string;
  advisees: { lrn: string; name: string }[];
}

interface CachedAccessRequest {
  id: string;
  adviserName: string;
  section: string;
  affectedAdvisees: {
    lrn: string;
    name: string;
    /** Persisted profile mascot (StudentMascot pool) carried from the list. */
    mascot?: string | null;
    sf10Status?: string;
    hasRecord?: boolean;
  }[];
  approvedLrns?: string[];
  reportedMissingLrns?: string[];
  approvedLrnAt?: Record<string, string>;
  checkedAt?: string | null;
  summary?: { total: number; has: number; missing: number };
}

/** Map a raw SF10 row status to the list's sf10Status verdict (mirrors the service). */
function checkVerdict(status: string | null | undefined): string {
  if (status === "released") return "validated";
  if (status === "available") return "verified";
  return "pending";
}

// Raw SF10 row status → desk verdict label (mirrors the Sf10Badge verdicts).
function recordLabel(status: string | null): string {
  if (status === "released") return "Validated";
  if (status === "available") return "Verified";
  if (status) return "Attached";
  return "Missing";
}

type DockRowState = "queued" | "matched" | "missing" | "reported" | "approved";

interface DockRow {
  lrn: string;
  name: string;
  state: DockRowState;
  recordStatus: string | null;
}

function rowLabel(row: DockRow, checking: boolean): string {
  if (row.state === "approved") return "Approved";
  if (row.state === "reported") return "Reported";
  if (row.state === "matched") return recordLabel(row.recordStatus);
  if (row.state === "missing") return "Missing";
  return checking ? "Verifying…" : "Not verified";
}

interface StreamStudent {
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
}

interface StreamDone {
  checkedAt: string;
  summary: { total: number; has: number; missing: number };
  reportedMissingLrns: string[];
  approvedLrns: string[];
  approvedLrnAt?: Record<string, string>;
  records: StreamStudent[];
}

type CheckPhase = "checking" | "done" | "error";

interface AdviserAccessCheckValue {
  /** Id of the request being verified, or null when idle. */
  checkingId: string | null;
  startCheck: (desk: AdviserAccessDesk, id: string) => void;
  /** Per-student grant for one matched student (whole request untouched). */
  approveLrn: (requestId: string, desk: AdviserAccessDesk, lrn: string) => void;
  /** Per-student "report as missing" (stored mark + adviser notice). */
  reportMissing: (requestId: string, desk: AdviserAccessDesk, lrn: string) => void;
  /** Bulk grant for every matched student (never reported/missing ones). */
  approveAll: (requestId: string, desk: AdviserAccessDesk) => void;
  /** "Check all" — the SF10 check for several requests, run one after another. */
  checkAll: (desk: AdviserAccessDesk, ids: string[]) => void;
  /** Board "Approve all" — bulk grant every matched student per request. */
  approveAllAwaiting: (desk: AdviserAccessDesk, requestIds: string[]) => void;
  /** Board "Report all" — report students without filed records (sequential). */
  reportAllAwaiting: (desk: AdviserAccessDesk, targets: { requestId: string; lrn: string }[]) => void;
  /** True while a board "Report all" sweep runs (blocks other decide surfaces). */
  bulkReporting: boolean;
  approvingLrn: string | null;
  reportingLrn: string | null;
  /** Full sets for per-row busy checks (parallel actions allowed). */
  approvingLrns: string[];
  reportingLrns: string[];
  bulkApproving: boolean;
  /** Any per-row/bulk decision in flight. */
  acting: boolean;
  isRowBusy: (lrn: string) => boolean;
}

const AdviserAccessCheckContext = React.createContext<AdviserAccessCheckValue | null>(null);

export function useAdviserAccessCheck(): AdviserAccessCheckValue {
  const ctx = React.useContext(AdviserAccessCheckContext);
  if (!ctx) throw new Error("useAdviserAccessCheck must be used inside AdviserAccessCheckProvider");
  return ctx;
}

function deskListKey(desk: AdviserAccessDesk): string[] {
  return desk === "record-keeper" ? ["record-keeper-adviser-access"] : ["registrar-adviser-access"];
}

function deskFullKeys(desk: AdviserAccessDesk): string[][] {
  return desk === "record-keeper"
    ? [["record-keeper-adviser-access"], ["record-keeper-overview"], ["record-keeper-notifications"]]
    : [["registrar-adviser-access"], ["registrar-overview"], ["registrar-notifications"]];
}

type RequestsCache = { requests?: (CachedAccessRequest & Record<string, unknown>)[] };

/**
 * Pages store the list as a bare array (`useQuery` returns
 * `mergeConfirmedMarks(res.data.requests)`), not `{ requests: [...] }`.
 * Helpers below read/write both shapes so dock commits move the kanban
 * in real time instead of silently no-op'ing until a manual refresh.
 */
function readCachedRequests(prev: unknown): CachedAccessRequest[] | null {
  if (Array.isArray(prev)) return prev as CachedAccessRequest[];
  if (prev && typeof prev === "object" && Array.isArray((prev as RequestsCache).requests)) {
    return (prev as RequestsCache).requests as CachedAccessRequest[];
  }
  return null;
}

function writeCachedRequests(prev: unknown, next: CachedAccessRequest[]): unknown {
  if (Array.isArray(prev)) return next;
  if (prev && typeof prev === "object" && Array.isArray((prev as RequestsCache).requests)) {
    return { ...(prev as Record<string, unknown>), requests: next };
  }
  return prev;
}

function findCachedRequest(qc: ReturnType<typeof useQueryClient>, id: string): CachedAccessRequest | null {
  for (const key of [["record-keeper-adviser-access"], ["registrar-adviser-access"]]) {
    const prev = qc.getQueryData<unknown>(key);
    const list = readCachedRequests(prev);
    const found = list?.find((r) => r.id === id);
    if (found) return found;
  }
  return null;
}

function patchRequestMarks(
  qc: ReturnType<typeof useQueryClient>,
  requestId: string,
  patch: (r: CachedAccessRequest) => CachedAccessRequest,
) {
  for (const key of [["record-keeper-adviser-access"], ["registrar-adviser-access"]]) {
    qc.setQueryData(key, (prev: unknown) => {
      const list = readCachedRequests(prev);
      if (!list) return prev;
      let changed = false;
      const requests = list.map((r) => {
        if (r.id !== requestId) return r;
        changed = true;
        return { ...r, ...patch(r) };
      });
      return changed ? writeCachedRequests(prev, requests) : prev;
    });
  }
}

export function AdviserAccessCheckProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const pathname = usePathname();
  const [run, setRun] = React.useState<CheckRun | null>(null);
  const [phase, setPhase] = React.useState<CheckPhase | null>(null);
  const [rows, setRows] = React.useState<DockRow[]>([]);
  const [summary, setSummary] = React.useState<{ total: number; has: number; missing: number } | null>(null);
  const [reportingLrns, setReportingLrns] = React.useState<string[]>([]);
  const [approvingLrns, setApprovingLrns] = React.useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = React.useState(false);
  const [bulkReporting, setBulkReporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [minimized, setMinimized] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const runToken = React.useRef(0);
  // "Check all" queue — request ids run one after another (the stream + dock
  // are single-run by design). beginCheckRef breaks the self-reference.
  const checkQueueRef = React.useRef<string[]>([]);
  const beginCheckRef = React.useRef<(desk: AdviserAccessDesk, id: string) => void>(() => {});

  const busy = phase === "checking";
  // Per-row busy only — different LRNs can act in parallel.
  const acting = approvingLrns.length > 0 || reportingLrns.length > 0 || bulkApproving || bulkReporting;
  const approvingLrn = approvingLrns[0] ?? null;
  const reportingLrn = reportingLrns[0] ?? null;

  const isRowBusy = React.useCallback(
    (lrn: string) => approvingLrns.includes(lrn) || reportingLrns.includes(lrn),
    [approvingLrns, reportingLrns],
  );

  // Steps derived from real SSE progress, not a fixed timer.
  const step = React.useMemo(() => {
    if (phase === "done") return CHECK_STEPS.length - 1;
    if (phase !== "checking") return 0;
    if (rows.length === 0) return 0;
    const resolved = rows.filter((r) => r.state !== "queued").length;
    if (resolved <= 0) return 0;
    if (resolved >= rows.length) return CHECK_STEPS.length - 1;
    return 1;
  }, [phase, rows]);

  const resetIdle = React.useCallback(() => {
    runToken.current += 1;
    checkQueueRef.current = [];
    abortRef.current?.abort();
    abortRef.current = null;
    setRun(null);
    setPhase(null);
    setRows([]);
    setSummary(null);
    setReportingLrns([]);
    setApprovingLrns([]);
    setBulkApproving(false);
    setBulkReporting(false);
    setError(null);
    setMinimized(false);
  }, []);

  // Never surface another session's run on the login screen.
  React.useEffect(() => {
    if (pathname !== "/login") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session reset on auth-route navigation; runs once per route change, not per render
    resetIdle();
  }, [pathname, resetIdle]);

  // Core runner: starts one SSE check run. The queue-driven "Check all"
  // calls this directly for the next id; the public entries below guard on
  // `busy` and own the queue.
  const beginCheck = React.useCallback(
    (desk: AdviserAccessDesk, id: string) => {
      // Display label + advisee list from either desk's cached list (pages may unmount).
      // Pages cache a bare array — read both shapes via the shared helper.
      let adviserName = "Adviser";
      let section = "";
      let advisees: { lrn: string; name: string }[] = [];
      {
        const found = findCachedRequest(qc, id);
        if (found) {
          adviserName = found.adviserName;
          section = found.section;
          // Dedupe by LRN (skip empties): duplicate/empty keys break the row list.
          const uniq = new Map<string, { lrn: string; name: string }>();
          for (const a of found.affectedAdvisees ?? []) {
            if (a?.lrn && !uniq.has(a.lrn)) uniq.set(a.lrn, { lrn: a.lrn, name: a.name });
          }
          advisees = [...uniq.values()];
        }
      }
      const token = ++runToken.current;
      setRun({ id, desk, adviserName, section, advisees });
      setPhase("checking");
      setRows(advisees.map((a) => ({ lrn: a.lrn, name: a.name, state: "queued" as const, recordStatus: null })));
      setSummary(null);
      setError(null);
      setMinimized(false);
      const controller = new AbortController();
      abortRef.current = controller;
      void (async () => {
        try {
          // Native fetch: axios has no streaming reader. Auth mirrors the
          // apiClient interceptors (bearer + active-term scope headers).
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          };
          const accessToken = getAccessToken();
          if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
          const scope = getActiveTermScope();
          if (scope?.schoolYearId) headers["x-school-year-id"] = scope.schoolYearId;
          if (scope?.termId) headers["x-term-id"] = scope.termId;
          const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
          const res = await fetch(
            `${base}/api/${desk}/adviser-access-requests/${id}/check-stream`,
            {
              method: "POST",
              headers,
              body: "{}",
              signal: controller.signal,
              credentials: "include",
            },
          );
          if (!res.ok || !res.body) {
            let message = "Could not run the SF10 check.";
            try {
              const errJson = (await res.json()) as { error?: { message?: unknown } };
              if (typeof errJson?.error?.message === "string" && errJson.error.message) {
                message = errJson.error.message;
              }
            } catch {
              // Keep the default message.
            }
            throw new Error(message);
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          let streamDone = false;
          while (!streamDone) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let cut: number;
            while ((cut = buf.indexOf("\n\n")) >= 0) {
              const chunk = buf.slice(0, cut);
              buf = buf.slice(cut + 2);
              let ev: string | null = null;
              const dataLines: string[] = [];
              for (const line of chunk.split("\n")) {
                if (line.startsWith("event:")) ev = line.slice(6).trim();
                else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
              }
              if (!ev || dataLines.length === 0) continue;
              let payload: unknown = null;
              try {
                payload = JSON.parse(dataLines.join("\n")) as unknown;
              } catch {
                continue;
              }
              if (token !== runToken.current) {
                void reader.cancel().catch(() => undefined);
                return;
              }
              if (ev === "student") {
                const s = payload as StreamStudent;
                // Upsert, not just update: if the page list cache was stale
                // at Check time, the snapshot may be empty — the stream
                // itself seeds each row as its verdict lands.
                const resolved: DockRow = {
                  lrn: s.lrn,
                  name: s.name,
                  state: s.record ? "matched" : "missing",
                  recordStatus: s.record?.status ?? null,
                };
                setRows((prev) =>
                  prev.some((r) => r.lrn === s.lrn)
                    ? prev.map((r) => (r.lrn === s.lrn ? resolved : r))
                    : [...prev, resolved],
                );
              } else if (ev === "done") {
                const d = payload as StreamDone;
                const reported = new Set(d.reportedMissingLrns ?? []);
                const granted = new Set(d.approvedLrns ?? []);
                // Authoritative reconcile: the done payload carries every
                // verdict, so the list is complete even if a student event
                // was missed mid-stream.
                setRows(
                  (d.records ?? []).map((s) => ({
                    lrn: s.lrn,
                    name: s.name,
                    state: (granted.has(s.lrn)
                      ? "approved"
                      : s.record
                        ? "matched"
                        : reported.has(s.lrn)
                          ? "reported"
                          : "missing") as DockRow["state"],
                    recordStatus: s.record?.status ?? null,
                  })),
                );
                setSummary(d.summary);
                setPhase("done");
                toast.success({
                  title: "SF10 check complete",
                  description: `${d.summary.has} attached · ${d.summary.missing} missing of ${d.summary.total} requested. Approve is now unlocked.`,
                });
                // Commit the check into the list cache instantly (same tick
                // as the dock) so the kanban moves in real time — the
                // invalidation below then only confirms with the server.
                // Rebuild affectedAdvisees from the authoritative stream
                // records (not just patch existing rows) so a stale/empty
                // snapshot can never leave the request with zero cards.
                qc.setQueryData(deskListKey(desk), (prev: unknown) => {
                  const list = readCachedRequests(prev);
                  if (!list) return prev;
                  const next = list.map((r) => {
                    if (r.id !== id) return r;
                    const existingByLrn = new Map((r.affectedAdvisees ?? []).map((a) => [a.lrn, a]));
                    const rebuilt = (d.records ?? []).map((s) => {
                      const prevA = existingByLrn.get(s.lrn) as
                        | (CachedAccessRequest["affectedAdvisees"][number] & Record<string, unknown>)
                        | undefined;
                      return {
                        ...(prevA ?? {}),
                        lrn: s.lrn,
                        name: s.name ?? (prevA as { name?: string } | undefined)?.name ?? s.lrn,
                        gradeLevel:
                          (prevA as { gradeLevel?: unknown } | undefined)?.gradeLevel ??
                          (r as unknown as { gradeLevel?: unknown }).gradeLevel,
                        section:
                          (prevA as { section?: unknown } | undefined)?.section ??
                          (r as unknown as { section?: unknown }).section,
                        hasAccount: s.hasAccount ?? (prevA as { hasAccount?: boolean } | undefined)?.hasAccount,
                        hasRecord: !!s.record,
                        sf10Status: checkVerdict(s.record?.status),
                      };
                    });
                    const affected =
                      rebuilt.length > 0
                        ? rebuilt
                        : (r.affectedAdvisees ?? []).map((a) => {
                            const v = new Map((d.records ?? []).map((s) => [s.lrn, s])).get(a.lrn);
                            if (!v) return a;
                            return {
                              ...a,
                              hasRecord: !!v.record,
                              sf10Status: checkVerdict(v.record?.status),
                            };
                          });
                    return {
                      ...r,
                      checkedAt: d.checkedAt,
                      summary: d.summary,
                      affectedAdvisees: affected,
                      approvedLrns: d.approvedLrns ?? r.approvedLrns,
                      reportedMissingLrns: d.reportedMissingLrns ?? r.reportedMissingLrns,
                      approvedLrnAt: { ...(r.approvedLrnAt ?? {}), ...(d.approvedLrnAt ?? {}) },
                    };
                  });
                  return writeCachedRequests(prev, next);
                });
                for (const key of deskFullKeys(desk)) {
                  void qc.invalidateQueries({ queryKey: key });
                }
                // "Check all" — chain the next queued request once this run
                // lands (same tick, so the dock never flashes "complete").
                const nextId = checkQueueRef.current.shift();
                if (nextId) beginCheckRef.current(desk, nextId);
                streamDone = true;
                break;
              } else if (ev === "error") {
                const p = payload as { message?: unknown };
                throw new Error(typeof p?.message === "string" && p.message ? p.message : "Check failed");
              }
            }
          }
        } catch (e) {
          if (token !== runToken.current || isCancelError(e)) return;
          // A failed run stops the whole sweep — the remaining requests stay
          // pending for a fresh "Check all" (the toast carries the reason).
          checkQueueRef.current = [];
          if (abortRef.current === controller) abortRef.current = null;
          const message = getErrorMessage(e, "Could not run the SF10 check.");
          setError(message);
          setPhase("error");
          toast.error({ title: "Check failed", description: message });
        }
      })();
    },
    [qc],
  );
  React.useEffect(() => {
    beginCheckRef.current = beginCheck;
  }, [beginCheck]);

  const startCheck = React.useCallback(
    (desk: AdviserAccessDesk, id: string) => {
      if (busy) return;
      checkQueueRef.current = [];
      beginCheck(desk, id);
    },
    [busy, beginCheck],
  );

  // "Check all" — every unchecked request, one SSE run after another.
  const checkAll = React.useCallback(
    (desk: AdviserAccessDesk, ids: string[]) => {
      if (busy || ids.length === 0) return;
      const [first, ...rest] = ids;
      checkQueueRef.current = rest;
      beginCheck(desk, first);
    },
    [busy, beginCheck],
  );

  // Per-student approval for one matched student (whole request untouched).
  // Honest pending: row stays "matched" with a spinner until the server
  // confirms — never flips early. Low latency comes from the fast
  // single-LRN backend path + list-only background refresh.
  const approveLrn = React.useCallback(
    (requestId: string, desk: AdviserAccessDesk, lrn: string) => {
      if (approvingLrns.includes(lrn) || reportingLrns.includes(lrn)) return;
      setApprovingLrns((prev) => (prev.includes(lrn) ? prev : [...prev, lrn]));
      setError(null);
      void (async () => {
        try {
          const res = await apiClient.post(`/api/${desk}/adviser-access-requests/${requestId}/approve-lrn`, { lrn });
          const serverLrns = (res.data as { approvedLrns?: string[]; approvedLrnAt?: Record<string, string> })?.approvedLrns;
          const serverAt = (res.data as { approvedLrnAt?: Record<string, string> })?.approvedLrnAt;
          // Confirmed first: any later (possibly stale) refetch is merged
          // with these marks and can never move the card back.
          recordConfirmedMarks(requestId, Array.isArray(serverLrns) ? serverLrns : [lrn], undefined, serverAt);
          if (Array.isArray(serverLrns)) {
            patchRequestMarks(qc, requestId, (r) => ({ ...r, approvedLrns: serverLrns, approvedLrnAt: { ...(r.approvedLrnAt ?? {}), ...(serverAt ?? {}) } }));
            // Commit only after 200 OK.
            setRows((prev) => prev.map((r) => (r.lrn === lrn ? { ...r, state: "approved" as const } : r)));
          } else {
            const now = new Date().toISOString();
            recordConfirmedMarks(requestId, [lrn], undefined, { [lrn]: now });
            patchRequestMarks(qc, requestId, (r) => ({
              ...r,
              approvedLrns: r.approvedLrns?.includes(lrn) ? r.approvedLrns : [...(r.approvedLrns ?? []), lrn],
              approvedLrnAt: { ...(r.approvedLrnAt ?? {}), [lrn]: r.approvedLrnAt?.[lrn] ?? now },
            }));
            setRows((prev) => prev.map((r) => (r.lrn === lrn ? { ...r, state: "approved" as const } : r)));
          }
          // Background confirm — kanban already moved via the cache patch.
          for (const key of deskFullKeys(desk)) {
            void qc.invalidateQueries({ queryKey: key });
          }
          toast.success({ title: "Access granted", description: "This student can now be read by the adviser." });
        } catch (e) {
          const message = getErrorMessage(e, "Could not approve this student.");
          setError(message);
          toast.error({ title: "Action failed", description: message });
        } finally {
          setApprovingLrns((prev) => prev.filter((x) => x !== lrn));
        }
      })();
    },
    [approvingLrns, reportingLrns, qc],
  );

  // "Report as missing" — same honest-pending contract: spinner first,
  // "Reported" only after the server confirms.
  const reportMissing = React.useCallback(
    (requestId: string, desk: AdviserAccessDesk, lrn: string) => {
      if (approvingLrns.includes(lrn) || reportingLrns.includes(lrn)) return;
      setReportingLrns((prev) => (prev.includes(lrn) ? prev : [...prev, lrn]));
      setError(null);
      void (async () => {
        try {
          const res = await apiClient.post(`/api/${desk}/adviser-access-requests/${requestId}/report-missing`, { lrn });
          const serverLrns = (res.data as { reportedMissingLrns?: string[] })?.reportedMissingLrns;
          recordConfirmedMarks(requestId, undefined, Array.isArray(serverLrns) ? serverLrns : [lrn]);
          if (Array.isArray(serverLrns)) {
            patchRequestMarks(qc, requestId, (r) => ({ ...r, reportedMissingLrns: serverLrns }));
            setRows((prev) => prev.map((r) => (r.lrn === lrn ? { ...r, state: "reported" as const } : r)));
          } else {
            patchRequestMarks(qc, requestId, (r) => ({
              ...r,
              reportedMissingLrns: r.reportedMissingLrns?.includes(lrn)
                ? r.reportedMissingLrns
                : [...(r.reportedMissingLrns ?? []), lrn],
            }));
            setRows((prev) => prev.map((r) => (r.lrn === lrn ? { ...r, state: "reported" as const } : r)));
          }
          for (const key of deskFullKeys(desk)) {
            void qc.invalidateQueries({ queryKey: key });
          }
          toast.success({ title: "Reported missing", description: "The adviser has been notified." });
        } catch (e) {
          const message = getErrorMessage(e, "Could not report this student.");
          setError(message);
          toast.error({ title: "Report failed", description: message });
        } finally {
          setReportingLrns((prev) => prev.filter((x) => x !== lrn));
        }
      })();
    },
    [approvingLrns, reportingLrns, qc],
  );

  // Bulk "approve all matched": processing state first, commit on success.
  const approveAll = React.useCallback(
    (requestId: string, desk: AdviserAccessDesk) => {
      if (bulkApproving || phase !== "done" || !run || run.id !== requestId) return;
      const matched = rows.filter((r) => r.state === "matched");
      if (matched.length === 0) return;
      setBulkApproving(true);
      setError(null);
      const matchedLrns = matched.map((r) => r.lrn);
      void (async () => {
        try {
          const res = await apiClient.post(`/api/${desk}/adviser-access-requests/${requestId}/approve-all`);
          const serverLrns = (res.data as { approvedLrns?: string[] })?.approvedLrns;
          const serverAt = (res.data as { approvedLrnAt?: Record<string, string> })?.approvedLrnAt;
          recordConfirmedMarks(requestId, Array.isArray(serverLrns) ? serverLrns : matchedLrns, undefined, serverAt);
          if (Array.isArray(serverLrns)) {
            patchRequestMarks(qc, requestId, (r) => ({ ...r, approvedLrns: serverLrns, approvedLrnAt: { ...(r.approvedLrnAt ?? {}), ...(serverAt ?? {}) } }));
            setRows((prev) =>
              prev.map((r) =>
                serverLrns.includes(r.lrn) && (r.state === "matched" || matchedLrns.includes(r.lrn))
                  ? { ...r, state: "approved" as const }
                  : r,
              ),
            );
          } else {
            const now = new Date().toISOString();
            const stamp: Record<string, string> = {};
            for (const lrn of matchedLrns) stamp[lrn] = now;
            recordConfirmedMarks(requestId, matchedLrns, undefined, stamp);
            patchRequestMarks(qc, requestId, (r) => {
              const mergedAt = { ...(r.approvedLrnAt ?? {}) };
              for (const lrn of matchedLrns) mergedAt[lrn] ??= now;
              return {
                ...r,
                approvedLrns: [...new Set([...(r.approvedLrns ?? []), ...matchedLrns])],
                approvedLrnAt: mergedAt,
              };
            });
            setRows((prev) => prev.map((r) => (r.state === "matched" ? { ...r, state: "approved" as const } : r)));
          }
          for (const key of deskFullKeys(desk)) {
            void qc.invalidateQueries({ queryKey: key });
          }
          toast.success({
            title: "Access granted",
            description: `${matchedLrns.length} matched student${matchedLrns.length === 1 ? "" : "s"} approved.`,
          });
        } catch (e) {
          const message = getErrorMessage(e, "Could not approve matched students.");
          setError(message);
          toast.error({ title: "Action failed", description: message });
        } finally {
          setBulkApproving(false);
        }
      })();
    },
    [bulkApproving, phase, run, rows, qc],
  );

  // Board "Approve all" — one bulk grant per request, sequential so the
  // server's read-modify-write on approvedLrns never overlaps. Reuses the
  // dock's bulkApproving flag so every Approve-all surface disables together.
  const approveAllAwaiting = React.useCallback(
    (desk: AdviserAccessDesk, requestIds: string[]) => {
      if (acting) return;
      const unique = [...new Set(requestIds)];
      if (unique.length === 0) return;
      setBulkApproving(true);
      setError(null);
      void (async () => {
        let grantedTotal = 0;
        try {
          for (const requestId of unique) {
            const res = await apiClient.post(`/api/${desk}/adviser-access-requests/${requestId}/approve-all`);
            const data = res.data as {
              approvedLrns?: string[];
              granted?: string[];
              approvedLrnAt?: Record<string, string>;
            };
            const serverLrns = Array.isArray(data?.approvedLrns) ? data.approvedLrns : [];
            const serverAt = data?.approvedLrnAt;
            recordConfirmedMarks(requestId, serverLrns, undefined, serverAt);
            patchRequestMarks(qc, requestId, (r) => ({
              ...r,
              approvedLrns: serverLrns,
              approvedLrnAt: { ...(r.approvedLrnAt ?? {}), ...(serverAt ?? {}) },
            }));
            grantedTotal += Array.isArray(data?.granted) ? data.granted.length : 0;
          }
          for (const key of deskFullKeys(desk)) {
            void qc.invalidateQueries({ queryKey: key });
          }
          toast.success({
            title: "Access granted",
            description:
              grantedTotal > 0
                ? `${grantedTotal} matched student${grantedTotal === 1 ? "" : "s"} approved.`
                : "Every matched student was already approved.",
          });
        } catch (e) {
          const message = getErrorMessage(e, "Could not approve matched students.");
          setError(message);
          toast.error({ title: "Action failed", description: message });
        } finally {
          setBulkApproving(false);
        }
      })();
    },
    [acting, qc],
  );

  // Board "Report all" — sequential per-LRN reports: the server appends to
  // reportedMissingLrns with a read-modify-write, so parallel posts for the
  // same request could drop marks.
  const reportAllAwaiting = React.useCallback(
    (desk: AdviserAccessDesk, targets: { requestId: string; lrn: string }[]) => {
      if (acting || targets.length === 0) return;
      setBulkReporting(true);
      setError(null);
      void (async () => {
        let reportedCount = 0;
        try {
          for (const t of targets) {
            const res = await apiClient.post(`/api/${desk}/adviser-access-requests/${t.requestId}/report-missing`, {
              lrn: t.lrn,
            });
            const serverLrns = (res.data as { reportedMissingLrns?: string[] })?.reportedMissingLrns;
            recordConfirmedMarks(t.requestId, undefined, Array.isArray(serverLrns) ? serverLrns : [t.lrn]);
            patchRequestMarks(qc, t.requestId, (r) => ({
              ...r,
              reportedMissingLrns: Array.isArray(serverLrns)
                ? serverLrns
                : [...new Set([...(r.reportedMissingLrns ?? []), t.lrn])],
            }));
            reportedCount += 1;
          }
          for (const key of deskFullKeys(desk)) {
            void qc.invalidateQueries({ queryKey: key });
          }
          toast.success({
            title: "Reported missing",
            description: `${reportedCount} student${reportedCount === 1 ? "" : "s"} reported — the adviser has been notified.`,
          });
        } catch (e) {
          const message = getErrorMessage(e, "Could not report missing students.");
          setError(message);
          toast.error({ title: "Report failed", description: message });
        } finally {
          setBulkReporting(false);
        }
      })();
    },
    [acting, qc],
  );

  const dismiss = React.useCallback(() => {
    if (busy) return;
    resetIdle();
  }, [busy, resetIdle]);

  const value = React.useMemo<AdviserAccessCheckValue>(
    () => ({
      checkingId: busy && run ? run.id : null,
      startCheck,
      checkAll,
      approveLrn,
      reportMissing,
      approveAll,
      approveAllAwaiting,
      reportAllAwaiting,
      approvingLrn,
      reportingLrn,
      approvingLrns,
      reportingLrns,
      bulkApproving,
      bulkReporting,
      acting,
      isRowBusy,
    }),
    [
      busy,
      run,
      startCheck,
      checkAll,
      approveLrn,
      reportMissing,
      approveAll,
      approveAllAwaiting,
      reportAllAwaiting,
      approvingLrn,
      reportingLrn,
      approvingLrns,
      reportingLrns,
      bulkApproving,
      bulkReporting,
      acting,
      isRowBusy,
    ],
  );

  const dockOpen = phase !== null && pathname !== "/login";
  // Defensive: rows must carry unique, non-empty keys — dedupe by LRN (keep
  // last) so a stale/duplicated snapshot can never break the row list.
  const visibleRows = React.useMemo(() => {
    const byLrn = new Map<string, DockRow>();
    for (const r of rows) {
      if (!r?.lrn) continue;
      byLrn.set(r.lrn, r);
    }
    return [...byLrn.values()];
  }, [rows]);
  const matchedCount = React.useMemo(() => visibleRows.filter((r) => r.state === "matched").length, [visibleRows]);
  const header =
    phase === "checking"
      ? "Verifying SF10 records"
      : phase === "error"
        ? "Check failed"
        : "Check complete";

  return (
    <AdviserAccessCheckContext.Provider value={value}>
      {children}
      {dockOpen ? (
        <div
          className="fixed bottom-4 right-4 z-50 w-80 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl sm:w-96"
          role="status"
          aria-live="polite"
          aria-label={header}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{header}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2"
              onClick={() => setMinimized((m) => !m)}
              aria-label={minimized ? "Expand verification status" : "Minimize verification status"}
            >
              {minimized ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2"
              onClick={dismiss}
              disabled={busy}
              aria-label="Dismiss verification status"
            >
              <X size={14} aria-hidden />
            </Button>
          </div>
          {!minimized ? (
            <div className="flex flex-col gap-2 p-3">
              {/* Centered like the filing overlays: ThoughtLine is inline-flex. */}
              <div className="flex justify-center">
                <ThoughtLine
                  working={phase === "checking"}
                  steps={CHECK_STEPS.slice(0, step + 1)}
                  label={
                    run
                      ? `Checking ${run.adviserName}${run.section ? ` · ${run.section}` : ""}…`
                      : "Checking SF10 records…"
                  }
                  doneLabel="Check complete"
                  fontSize={13}
                  collapsible
                  collapseOnSettle
                  showTimer
                />
              </div>
              {summary ? (
                <p className="text-center text-xs text-muted-foreground" aria-live="polite">
                  {summary.has} attached · {summary.missing} missing of {summary.total} requested
                </p>
              ) : null}
              {phase === "done" && run ? (
                <div className="flex flex-col gap-1">
                  <p className="text-center text-[11px] text-muted-foreground">
                    Decide per student below — one by one.
                  </p>
                  {matchedCount > 0 ? (
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 border border-transparent bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/30 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700"
                        disabled={bulkApproving || acting}
                        onClick={() => approveAll(run.id, run.desk)}
                        aria-label={`Approve all ${matchedCount} matched students`}
                        title="Grant every matched student, never reported/missing ones"
                      >
                        {bulkApproving ? (
                          <Loader2 size={13} className="animate-spin" aria-hidden />
                        ) : null}
                        Approve all matched ({matchedCount})
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {visibleRows.length > 0 ? (
                <ul className="flex max-h-56 min-w-0 flex-col gap-1 overflow-y-auto" aria-label="Advisees in this request">
                  {visibleRows.map((r) => {
                    const rowBusy = isRowBusy(r.lrn);
                    return (
                      <li key={r.lrn} className="flex min-w-0 items-center gap-2 rounded px-1 py-1">
                        <span className="shrink-0" aria-hidden>
                          {r.state === "matched" || r.state === "approved" ? (
                            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                          ) : r.state === "reported" ? (
                            <Megaphone size={15} className="text-red-600 dark:text-red-400" />
                          ) : r.state === "missing" ? (
                            <XCircle size={15} className="text-destructive" />
                          ) : phase === "checking" ? (
                            <Loader2 size={15} className="animate-spin text-muted-foreground" />
                          ) : (
                            <FileText size={15} className="text-muted-foreground" />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-xs font-medium" title={r.name}>
                            {r.name}
                          </span>
                          <span className="truncate font-mono text-[11px] text-muted-foreground" title={r.lrn}>
                            {r.lrn}
                          </span>
                        </span>
                        {phase === "done" && r.state === "matched" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 shrink-0 border border-transparent bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/30 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700"
                            disabled={rowBusy || bulkApproving}
                            onClick={() => {
                              if (run) approveLrn(run.id, run.desk, r.lrn);
                            }}
                            aria-label={`Approve access for ${r.name}`}
                            title="Approve this student only — decides on confirm"
                          >
                            {approvingLrns.includes(r.lrn) ? (
                              <Loader2 size={13} className="animate-spin" aria-hidden />
                            ) : null}
                            {approvingLrns.includes(r.lrn) ? "Approving…" : "Approve"}
                          </Button>
                        ) : phase === "done" && r.state === "missing" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-6 shrink-0 bg-red-600 px-2 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                            disabled={rowBusy || bulkApproving}
                            onClick={() => {
                              if (run) reportMissing(run.id, run.desk, r.lrn);
                            }}
                            aria-label={`Report ${r.name} as missing`}
                          >
                            {reportingLrns.includes(r.lrn) ? (
                              <Loader2 size={13} className="animate-spin" aria-hidden />
                            ) : null}
                            {reportingLrns.includes(r.lrn) ? "Reporting…" : "Report"}
                          </Button>
                        ) : (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {r.state === "reported" ? "Reported" : rowLabel(r, phase === "checking")}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {phase === "error" && error ? (
                <p role="alert" className="text-center text-xs text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </AdviserAccessCheckContext.Provider>
  );
}
