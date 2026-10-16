"use client";

import * as React from "react";
import { Calendar, CheckCircle2, Clock, FileSearch, Loader2, Megaphone, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdviserAccessCheck, type AdviserAccessDesk } from "./adviser-access-check-context";
import {
  formatApproveDate,
  formatRelativeTime,
  toBoardStudents,
  type AdviserAccessRequest,
  type BoardStudent,
} from "./adviser-access-types";
import { initials } from "./adviser-access-shared";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./adviser-access-tables.module.css";

export type DenyFn = (id: string, reason: string) => Promise<void>;

function Dot({ className }: { className: string }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${className}`} aria-hidden />;
}

function StatePill({ s }: { s: BoardStudent }) {
  const base =
    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium";
  if (s.state === "approved")
    return (
      <span className={`${base} border-green-500/40 bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400`}>
        <Dot className="bg-emerald-500" />
        Approved
      </span>
    );
  if (s.state === "reported")
    return (
      <span className={`${base} border-red-500/40 bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400`}>
        <Dot className="bg-red-500" />
        Reported
      </span>
    );
  if (s.state === "pendingChecking")
    return (
      <span className={`${base} border-border bg-muted text-muted-foreground`}>
        <Dot className="bg-gray-400" />
        Unchecked
      </span>
    );
  return s.hasRecord ? (
    <span className={`${base} border-green-500/40 bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400`}>
      <Dot className="bg-emerald-500" />
      Attached
    </span>
  ) : (
    <span className={`${base} border-red-500/40 bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400`}>
      <Dot className="bg-red-500" />
      Missing
    </span>
  );
}

function AvatarCircle({ name }: { name: string }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
      aria-hidden
      title={name}
    >
      {initials(name)}
    </span>
  );
}

function StudentCard({ s, desk, showAction }: { s: BoardStudent; desk: AdviserAccessDesk; showAction?: boolean }) {
  const accessCheck = useAdviserAccessCheck();
  const busy = accessCheck.isRowBusy(s.lrn) || accessCheck.bulkApproving;
  const approving = accessCheck.approvingLrns.includes(s.lrn);
  const reporting = accessCheck.reportingLrns.includes(s.lrn);
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] font-medium text-muted-foreground" title={s.lrn}>
          {s.lrn}
        </span>
        <AvatarCircle name={s.name} />
      </div>
      <p className="truncate text-sm font-semibold leading-snug" title={s.name}>
        {s.name}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatePill s={s} />
        <span className="inline-flex items-center rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
          {s.gradeLevel} · {s.section}
        </span>
        {s.state === "approved" && formatApproveDate(s.approvedAt) ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
            title={`Approved ${new Date(s.approvedAt as string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
          >
            <Calendar size={11} aria-hidden />
            {formatApproveDate(s.approvedAt)}
          </span>
        ) : null}
      </div>
      {showAction && s.state === "awaiting" && s.hasRecord ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="h-6 shrink-0 border border-transparent bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/30 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700"
            disabled={busy}
            onClick={() => accessCheck.approveLrn(s.requestId, desk, s.lrn)}
            aria-label={`Approve access for ${s.name}`}
            title="Approve this student"
          >
            {approving ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            {approving ? "Approving…" : "Approve"}
          </Button>
        </div>
      ) : showAction && s.state === "awaiting" && !s.hasRecord ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="h-6 shrink-0 bg-red-600 px-2 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            disabled={busy}
            onClick={() => accessCheck.reportMissing(s.requestId, desk, s.lrn)}
            aria-label={`Report ${s.name} as missing`}
            title="Report as missing"
          >
            {reporting ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            {reporting ? "Reporting…" : "Report"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function ColumnHead({
  icon,
  title,
  count,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  label: string;
}) {
  return (
    <div className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2" aria-label={`${label}, ${count} students`}>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
        {icon} {title}
      </span>
      <span className="text-xs font-semibold text-muted-foreground">{count}</span>
    </div>
  );
}

export function AdviserAccessKanban({
  requests,
  desk,
  onCheck,
  checkingId,
  onDeny,
  denyingId,
}: {
  requests: AdviserAccessRequest[];
  desk: AdviserAccessDesk;
  onCheck: (id: string) => void;
  checkingId: string | null;
  onDeny: DenyFn;
  denyingId: string | null;
}) {
  void desk;
  void onDeny;
  void denyingId;
  const cards = React.useMemo(() => toBoardStudents(requests), [requests]);

  const cols = React.useMemo(() => {
    const pending: BoardStudent[] = [];
    const awaiting: BoardStudent[] = [];
    const approved: BoardStudent[] = [];
    const reported: BoardStudent[] = [];
    for (const c of cards) {
      if (c.state === "pendingChecking") pending.push(c);
      else if (c.state === "awaiting") awaiting.push(c);
      else if (c.state === "approved") approved.push(c);
      else reported.push(c);
    }
    return { pending, awaiting, approved, reported };
  }, [cards]);

  // Pending groups by request — Check is per-request.
  const pendingGroups = React.useMemo(() => {
    const byReq = new Map<string, { req: AdviserAccessRequest; students: BoardStudent[] }>();
    for (const r of requests) {
      if (r.checkedAt) continue;
      const students = cols.pending.filter((c) => c.requestId === r.id);
      if (students.length > 0) byReq.set(r.id, { req: r, students });
    }
    return [...byReq.values()];
  }, [requests, cols.pending]);

  if (requests.length === 0) {
    return (
      <section className={assign.card} aria-labelledby="adviser-kanban">
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className={`${styles.emptyBlock} relative`}>
          <span className={styles.emptyIcon} aria-hidden>
            <ShieldQuestion />
          </span>
          <p className={styles.emptyTitle}>All caught up</p>
          <p className={styles.emptyHint}>No adviser access requests awaiting your decision.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="adviser-kanban" className="flex min-w-0 flex-col gap-4">
      <div className={`${styles.header} relative`}>
        <div className={styles.headerText}>
          <h2 id="adviser-kanban" className="text-base font-semibold">
            Request Board
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Run Check per request, then decide per student in the check card (bottom-right).{" "}
            {cards.length} students.
          </p>
        </div>
      </div>
      <div className={`${styles.kanbanGrid} relative`}>
        <div
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
          aria-label={`Pending checking, ${cols.pending.length} students`}
        >
          <ColumnHead
            icon={<Clock size={14} aria-hidden className="text-amber-500" />}
            title="Pending checking"
            count={cols.pending.length}
            label="Pending checking"
          />
          {pendingGroups.length === 0 ? (
            <p className="flex min-h-24 flex-1 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">Nothing waiting for check.</p>
          ) : (
            <ul className="flex max-h-[32rem] min-w-0 flex-col gap-2 overflow-y-auto">
              {pendingGroups.map(({ req, students }) => {
                const checking = checkingId === req.id;
                const busy = checkingId !== null;
                return (
                  <li
                    key={req.id}
                    className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-medium text-muted-foreground" title={`${req.gradeLevel} · ${req.section} · ${formatRelativeTime(req.requestedAt)}`}>
                        {req.gradeLevel} · {req.section} · {formatRelativeTime(req.requestedAt)}
                      </span>
                      <AvatarCircle name={req.adviserName} />
                    </div>
                    <p className="truncate text-sm font-semibold leading-snug" title={req.adviserName}>
                      {req.adviserName}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <Dot className="bg-gray-400" />
                        {students.length} student{students.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 shrink-0 border border-transparent bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/30 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700"
                        disabled={busy}
                        title="Match requested LRNs against filed SF10 records"
                        onClick={() => onCheck(req.id)}
                      >
                        {checking ? (
                          <Loader2 size={13} className="animate-spin" aria-hidden />
                        ) : (
                          <FileSearch size={13} aria-hidden />
                        )}
                        {checking ? "Checking…" : "Check"}
                      </Button>
                    </div>
                    <ul className="flex min-w-0 flex-col gap-2">
                      {students.map((s) => (
                        <StudentCard key={`${s.requestId}:${s.lrn}`} s={s} desk={desk} />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
          aria-label={`Awaiting decision, ${cols.awaiting.length} students`}
        >
          <ColumnHead
            icon={<FileSearch size={14} aria-hidden className="text-blue-500" />}
            title="Awaiting decision"
            count={cols.awaiting.length}
            label="Awaiting decision"
          />
          {cols.awaiting.length === 0 ? (
            <p className="flex min-h-24 flex-1 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">Nothing awaiting decision.</p>
          ) : (
            <ul className="flex max-h-[32rem] min-w-0 flex-col gap-2 overflow-y-auto">
              {cols.awaiting.map((s) => (
                <StudentCard key={`${s.requestId}:${s.lrn}`} s={s} desk={desk} showAction />
              ))}
            </ul>
          )}
        </div>

        <div
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
          aria-label={`Approved, ${cols.approved.length} students`}
        >
          <ColumnHead
            icon={<CheckCircle2 size={14} aria-hidden className="text-emerald-600 dark:text-emerald-400" />}
            title="Approved"
            count={cols.approved.length}
            label="Approved"
          />
          {cols.approved.length === 0 ? (
            <p className="flex min-h-24 flex-1 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">No approvals yet.</p>
          ) : (
            <ul className="flex max-h-[32rem] min-w-0 flex-col gap-2 overflow-y-auto">
              {cols.approved.map((s) => (
                <StudentCard key={`${s.requestId}:${s.lrn}`} s={s} desk={desk} />
              ))}
            </ul>
          )}
        </div>

        <div
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
          aria-label={`Reported missing, ${cols.reported.length} students`}
        >
          <ColumnHead
            icon={<Megaphone size={14} aria-hidden className="text-red-600 dark:text-red-400" />}
            title="Reported missing"
            count={cols.reported.length}
            label="Reported missing"
          />
          {cols.reported.length === 0 ? (
            <p className="flex min-h-24 flex-1 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">Nothing reported.</p>
          ) : (
            <ul className="flex max-h-[32rem] min-w-0 flex-col gap-2 overflow-y-auto">
              {cols.reported.map((s) => (
                <StudentCard key={`${s.requestId}:${s.lrn}`} s={s} desk={desk} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
