"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { ProgressDock } from "@/components/ui/progress-dock";
import { Textarea } from "@/components/ui/textarea";
import { formatGrade, formatSection } from "@/lib/utils";
import type { LrnMatchResult, PendingStudent } from "./types";
import styles from "./lrn-verification.module.css";

/* Rectangle pills — same amber / green / red tones as the board rows. */
const PILL =
  "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium";
const PILL_AMBER =
  "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";
const PILL_GREEN =
  "border-green-500/40 bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-400";
const PILL_RED =
  "border-red-500/40 bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400";

type MatchState =
  | { status: "loading" }
  | { status: "done"; data: LrnMatchResult }
  | { status: "error"; message: string };

type Props = {
  student: PendingStudent;
  onClose: () => void;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  approving?: boolean;
};

function messageOf(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    "Verification failed. Please try again."
  );
}

function matchLrn(lrn: string, name: string): Promise<LrnMatchResult> {
  return apiClient
    .get<LrnMatchResult>("/api/auth/match-lrn", { params: { lrn, name } })
    .then((res) => res.data);
}

/**
 * LRN verification in the shared progress dock (same chrome and behavior as
 * every other bottom-right dock). Opening it runs the LRN lookup right away
 * (the ThoughtLine narrates the matching steps), then the verdict moves into
 * the dock title and the submitted-vs-record comparison settles in below
 * with the approve action last.
 */
export function LrnVerifyDock({ student, onClose, onApprove, onReject, approving }: Props) {
  const trimmed = student.lrn.trim();
  const valid = trimmed.length > 0 && trimmed !== "—";
  const [state, setState] = React.useState<MatchState>(() =>
    valid
      ? { status: "loading" }
      : { status: "error", message: "No LRN was provided at sign-up." },
  );

  // Auto-run once per dock mount (the page keys the dock by student id, so
  // switching rows remounts and re-runs); "Re-check" reuses run().
  React.useEffect(() => {
    if (!valid) return undefined;
    let cancelled = false;
    matchLrn(trimmed, student.name)
      .then((data) => {
        if (!cancelled) setState({ status: "done", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", message: messageOf(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [valid, trimmed, student.name]);

  const run = React.useCallback(() => {
    if (!valid) return;
    setState({ status: "loading" });
    matchLrn(trimmed, student.name)
      .then((data) => setState({ status: "done", data }))
      .catch((err: unknown) => setState({ status: "error", message: messageOf(err) }));
  }, [valid, trimmed, student.name]);

  // Escape closes the dock — locked while an approval is in flight.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !approving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, approving]);

  const steps = [
    `Looking up ${valid ? trimmed : "the submitted LRN"} in the official records`,
    "Cross-checking the submitted name",
    "Comparing grade & section",
    "Resolving the verification verdict",
  ];

  // Verdict lives in the title (like every shared dock's outcome), with a
  // one-line summary under the ThoughtLine.
  const title =
    state.status === "loading"
      ? "Verifying LRN"
      : state.status === "error"
        ? "Verification failed"
        : state.data.verdict === "match"
          ? "Identity confirmed"
          : state.data.verdict === "mismatch"
            ? "Details do not match"
            : "LRN not in records";
  const summary =
    state.status === "error" ? (
      <span className="text-destructive">{state.message}</span>
    ) : state.status === "done" ? (
      state.data.verdict === "match"
        ? "All checked fields match the official record."
        : state.data.verdict === "mismatch"
          ? "One or more fields differ — review the flags below."
          : "No official record carries this LRN number."
    ) : null;

  return (
    <ProgressDock
      title={title}
      working={state.status === "loading"}
      steps={state.status === "error" ? steps.slice(0, 2) : steps}
      label={`Verifying ${student.name}…`}
      doneLabel="Verification complete"
      summary={summary}
      onDismiss={onClose}
      dismissDisabled={approving}
      ariaLabel={`LRN verification for ${student.name}`}
    >
      {state.status === "loading" ? null : state.status === "error" ? (
        <ErrorActions
          student={student}
          canRetry={valid}
          busy={approving}
          onRetry={run}
          onReject={onReject}
          onDone={onClose}
        />
      ) : (
        <Result
          data={state.data}
          student={student}
          onRecheck={run}
          onApprove={onApprove}
          onReject={onReject}
          approving={approving}
          onDone={onClose}
        />
      )}
    </ProgressDock>
  );
}

/** Reject-with-reason form — replaces the actions row once opened. */
function RejectForm({
  busy,
  onReject,
  onDone,
  onCancel,
}: {
  busy?: boolean;
  onReject: (reason: string) => Promise<void>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed || busy || submitting) return;
    setSubmitting(true);
    void (async () => {
      try {
        await onReject(trimmed);
        onDone();
      } catch {
        // Failure feedback comes from the page mutation; keep the form open.
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea
        rows={2}
        className="min-h-14 text-xs"
        placeholder="Reason for rejection (required)"
        aria-label="Reason for rejection"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={busy || submitting}
      />
      <div className={styles.actions}>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onCancel}
          disabled={busy || submitting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={submit}
          disabled={busy || submitting || !reason.trim()}
          aria-busy={busy || submitting || undefined}
        >
          {submitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {submitting ? "Rejecting…" : "Confirm reject"}
        </Button>
      </div>
    </div>
  );
}

/** Error state (no LRN provided or a failed lookup): retry plus the reject path. */
function ErrorActions({
  student,
  canRetry,
  busy,
  onRetry,
  onReject,
  onDone,
}: {
  student: PendingStudent;
  canRetry: boolean;
  busy?: boolean;
  onRetry: () => void;
  onReject: (reason: string) => Promise<void>;
  onDone: () => void;
}) {
  const [rejectOpen, setRejectOpen] = React.useState(false);
  if (rejectOpen) {
    return (
      <RejectForm
        busy={busy}
        onReject={onReject}
        onDone={onDone}
        onCancel={() => setRejectOpen(false)}
      />
    );
  }
  return (
    <div className={styles.actions}>
      {canRetry ? (
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onRetry}
          disabled={busy}
        >
          Run again
        </Button>
      ) : null}
      <Button
        variant="destructive"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => setRejectOpen(true)}
        disabled={busy}
        aria-label={`Reject ${student.name}`}
      >
        Reject…
      </Button>
    </div>
  );
}

function Result({
  data,
  student,
  onRecheck,
  onApprove,
  onReject,
  approving,
  onDone,
}: {
  data: LrnMatchResult;
  student: PendingStudent;
  onRecheck: () => void;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  approving?: boolean;
  onDone: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const match = data.verdict === "match";
  const roster = data.roster;
  const submittedGrade = `${formatGrade(student.gradeLevel)}${
    student.section && student.section !== "—" ? ` · ${formatSection(student.section)}` : ""
  }`;
  const recordGrade = roster
    ? `${formatGrade(roster.gradeLevel)}${roster.section ? ` · ${formatSection(roster.section)}` : ""}`
    : null;

  // Staggered entry: each comparison row settles in, then the actions.
  const enter = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.32, ease: "easeOut" as const, delay: reduce ? 0 : delay },
  });

  return (
    <div className="flex flex-col gap-2">
      <section>
        <h3 className={styles.sectionLabel}>Cross-verification</h3>
        <div className={styles.compareCard}>
          <motion.div className={styles.compareHead} {...enter(0.05)}>
            <span className={styles.compareCol}>Submitted</span>
            <span className={styles.compareCol}>Official record</span>
          </motion.div>

          <CompareRow
            index={0}
            label="LRN"
            submitted={data.claimedLrn}
            record={roster ? roster.lrn : null}
            ok={data.lrnMatch}
          />
          <CompareRow
            index={1}
            label="Name"
            submitted={student.name}
            record={roster ? roster.fullName : null}
            ok={data.nameMatch}
            note={roster ? `${Math.round((data.nameSimilarity ?? 0) * 100)}% similar` : undefined}
          />
          <CompareRow
            index={2}
            label="Grade / Section"
            submitted={submittedGrade}
            record={recordGrade}
            ok={match}
          />
        </div>
      </section>

      {!match ? (
        <motion.p className={styles.hint} {...enter(0.3)}>
          Registrar: confirm with the official SF10 / enrollment record before approving.
        </motion.p>
      ) : null}

      <motion.div className={styles.actions} {...enter(0.34)}>
        {rejectOpen ? (
          <RejectForm
            busy={approving}
            onReject={onReject}
            onDone={onDone}
            onCancel={() => setRejectOpen(false)}
          />
        ) : (
          <>
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setRejectOpen(true)}
              disabled={approving}
            >
              Reject…
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onRecheck}
              disabled={approving}
            >
              Re-check
            </Button>
            {match ? (
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={approving}
                aria-busy={approving || undefined}
                onClick={() => {
                  void (async () => {
                    try {
                      await onApprove();
                      onDone();
                    } catch {
                      /* Failure feedback comes from the page mutation; keep the
                         dock open so the registrar can retry or re-check. */
                    }
                  })();
                }}
              >
                {approving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {approving ? "Approving…" : "Approve account"}
              </Button>
            ) : null}
          </>
        )}
      </motion.div>
    </div>
  );
}

function CompareRow({
  index,
  label,
  submitted,
  record,
  ok,
  note,
}: {
  index: number;
  label: string;
  submitted: string;
  /** Official record value — null when the LRN was not found. */
  record: string | null;
  ok: boolean;
  note?: string;
}) {
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.div
      className={styles.compareRow}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: reduce ? 0 : 0.1 + index * 0.06 }}
    >
      <div className={styles.compareCell}>
        <span className={styles.cellLabel}>{label}</span>
        <span className={`${PILL} ${PILL_AMBER} tabular-nums`} title={submitted}>
          {submitted}
        </span>
      </div>
      <div className={styles.compareCell}>
        {record ? (
          <span className={`${PILL} ${PILL_AMBER} tabular-nums`} title={record}>
            {record}
          </span>
        ) : (
          <span className={styles.valueMuted}>not found</span>
        )}
        <span className={styles.cellStatus}>
          {ok ? (
            <span className={`${PILL} ${PILL_GREEN}`}>
              <CircleCheck className="size-3" aria-hidden />
              Match
            </span>
          ) : (
            <span className={`${PILL} ${PILL_RED}`}>
              <CircleX className="size-3" aria-hidden />
              No match
            </span>
          )}
          {note ? <span className={styles.note}>{note}</span> : null}
        </span>
      </div>
    </motion.div>
  );
}
