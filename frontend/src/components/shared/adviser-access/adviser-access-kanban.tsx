"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Calendar, CheckCircle2, Clock, FileSearch, Loader2, Megaphone, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useAdviserAccessCheck, type AdviserAccessDesk } from "./adviser-access-check-context";
import {
  formatApproveDate,
  toBoardStudents,
  type AdviserAccessRequest,
  type BoardStudent,
} from "./adviser-access-types";
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

// Student card — same staggered settle as the final-grades RowList rows:
// mount fade/slide with a capped per-index delay, exit lift on column moves,
// and layout shifts when siblings leave. Reduced motion drops all of it.
function StudentCard({
  s,
  index = 0,
  reduceMotion = false,
  showAdviser = false,
}: {
  s: BoardStudent;
  index?: number;
  reduceMotion?: boolean;
  showAdviser?: boolean;
}) {
  return (
    <motion.li
      layout={!reduceMotion}
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm dark:bg-card"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -6, transition: { duration: 0.18 } }}
      transition={{
        duration: 0.38,
        ease: "easeOut",
        // Stagger the first ~10 cards per column; cap delay so wide columns
        // stay snappy.
        delay: reduceMotion ? 0 : Math.min(index * 0.035, 0.35),
        layout: { duration: 0.28, ease: "easeOut" },
      }}
      style={{ willChange: "transform, opacity" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="truncate text-sm font-semibold leading-snug" title={s.name}>
            {s.name}
          </p>
          <span
            className="inline-block w-fit min-w-0 max-w-full truncate rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
            title={s.lrn}
          >
            {s.lrn}
          </span>
        </div>
        <StudentMascot name={s.name} seed={s.lrn} character={s.mascot ?? undefined} size={40} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatePill s={s} />
        {s.state === "approved" && formatApproveDate(s.approvedAt) ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
            title={`Approved ${new Date(s.approvedAt as string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
          >
            <Calendar size={11} aria-hidden />
            {formatApproveDate(s.approvedAt)}
          </span>
        ) : null}
        {showAdviser ? (
          <span
            className="ml-auto min-w-0 truncate text-[11px] font-medium text-muted-foreground"
            title={`Requested by ${s.adviserName}`}
          >
            {s.adviserName}
          </span>
        ) : null}
      </div>
    </motion.li>
  );
}

// Column bulk-action buttons — same solid tones as the per-card actions
// they replace (emerald grant / red report), sized for the header row.
const COL_BTN = "h-6 shrink-0 px-2 text-[11px] font-medium";
const COL_GREEN_BTN = `${COL_BTN} border border-transparent bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/30 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700`;
const COL_RED_BTN = `${COL_BTN} bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700`;

function ColumnHead({
  icon,
  title,
  count,
  label,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  label: string;
  /** Bulk actions sit at the right of the title row, next to the count. */
  actions?: React.ReactNode;
}) {
  return (
    <div
      className="-mx-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-border px-3.5 pb-2"
      aria-label={`${label}, ${count} students`}
    >
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
        {icon} {title}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">{count}</span>
        {actions ?? null}
      </span>
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
  animateOnMount = false,
}: {
  requests: AdviserAccessRequest[];
  desk: AdviserAccessDesk;
  onCheck: (id: string) => void;
  checkingId: string | null;
  onDeny: DenyFn;
  denyingId: string | null;
  /** Run the staggered card cascade on first paint (desk opt-in, same
      semantics as RowList's `animateOnMount`). Off by default so cache
      patches and refetches don't re-animate existing cards. */
  animateOnMount?: boolean;
}) {
  const { acting, bulkApproving, bulkReporting, checkAll, approveAllAwaiting, reportAllAwaiting } =
    useAdviserAccessCheck();
  const reduceMotion = useReducedMotion() ?? false;
  // A check sweep is active whenever the dock holds a live run.
  const checking = checkingId !== null;
  void onCheck;
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

  // Awaiting cards split by check verdict: matched ones take Approve all,
  // record-less ones take Report all — the header buttons mirror the old
  // per-student actions without repeating them on every card.
  const awaitingMatched = React.useMemo(() => cols.awaiting.filter((s) => s.hasRecord), [cols.awaiting]);
  const awaitingMissing = React.useMemo(() => cols.awaiting.filter((s) => !s.hasRecord), [cols.awaiting]);

  // Unchecked requests that still have students on the board — the Check all
  // sweep runs every one of them, in order.
  const pendingRequestIds = React.useMemo(() => {
    const withStudents = new Set(cols.pending.map((s) => s.requestId));
    return requests.filter((r) => withStudents.has(r.id)).map((r) => r.id);
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
            Run Check all on the pending column, then Approve all / Report all on the
            awaiting column. {cards.length} students.
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
            actions={
              pendingRequestIds.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  className={COL_BTN}
                  disabled={checking || acting}
                  onClick={() => checkAll(desk, pendingRequestIds)}
                  title="Run the SF10 check for every request, one after another"
                >
                  {checking ? (
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                  ) : (
                    <FileSearch size={12} aria-hidden />
                  )}
                  {checking ? "Checking…" : "Check all"}
                </Button>
              ) : null
            }
          />
          {cols.pending.length === 0 ? (
            <p className="flex min-h-24 flex-1 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">Nothing waiting for check.</p>
          ) : (
            <motion.ul
              layout={!reduceMotion}
              transition={{ layout: { duration: 0.28, ease: "easeOut" } }}
              className={`${styles.boardScroll} flex min-w-0 flex-col gap-2`}
            >
              <AnimatePresence initial={animateOnMount}>
                {cols.pending.map((s, index) => (
                  <StudentCard key={`${s.requestId}:${s.lrn}`} s={s} index={index} reduceMotion={reduceMotion} showAdviser />
                ))}
              </AnimatePresence>
            </motion.ul>
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
            actions={
              <>
                {awaitingMatched.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    className={COL_GREEN_BTN}
                    disabled={acting || checking}
                    onClick={() =>
                      approveAllAwaiting(desk, [...new Set(awaitingMatched.map((s) => s.requestId))])
                    }
                    title="Grant every student with a filed SF10 record"
                  >
                    {bulkApproving ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                    Approve all
                  </Button>
                ) : null}
                {awaitingMissing.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    className={COL_RED_BTN}
                    disabled={acting || checking}
                    onClick={() =>
                      reportAllAwaiting(
                        desk,
                        awaitingMissing.map((s) => ({ requestId: s.requestId, lrn: s.lrn })),
                      )
                    }
                    title="Report every student with no filed SF10 record"
                  >
                    {bulkReporting ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                    Report all
                  </Button>
                ) : null}
              </>
            }
          />
          {cols.awaiting.length === 0 ? (
            <p className="flex min-h-24 flex-1 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">Nothing awaiting decision.</p>
          ) : (
            <motion.ul
              layout={!reduceMotion}
              transition={{ layout: { duration: 0.28, ease: "easeOut" } }}
              className={`${styles.boardScroll} flex min-w-0 flex-col gap-2`}
            >
              <AnimatePresence initial={animateOnMount}>
                {cols.awaiting.map((s, index) => (
                  <StudentCard key={`${s.requestId}:${s.lrn}`} s={s} index={index} reduceMotion={reduceMotion} />
                ))}
              </AnimatePresence>
            </motion.ul>
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
            <motion.ul
              layout={!reduceMotion}
              transition={{ layout: { duration: 0.28, ease: "easeOut" } }}
              className={`${styles.boardScroll} flex min-w-0 flex-col gap-2`}
            >
              <AnimatePresence initial={animateOnMount}>
                {cols.approved.map((s, index) => (
                  <StudentCard key={`${s.requestId}:${s.lrn}`} s={s} index={index} reduceMotion={reduceMotion} />
                ))}
              </AnimatePresence>
            </motion.ul>
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
            <motion.ul
              layout={!reduceMotion}
              transition={{ layout: { duration: 0.28, ease: "easeOut" } }}
              className={`${styles.boardScroll} flex min-w-0 flex-col gap-2`}
            >
              <AnimatePresence initial={animateOnMount}>
                {cols.reported.map((s, index) => (
                  <StudentCard key={`${s.requestId}:${s.lrn}`} s={s} index={index} reduceMotion={reduceMotion} />
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </div>
      </div>
    </section>
  );
}
