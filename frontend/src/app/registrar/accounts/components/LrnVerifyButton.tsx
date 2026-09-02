"use client";

import * as React from "react";
import {
  Fingerprint,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  CircleCheck,
  CircleX,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { formatGrade, formatSection } from "@/lib/utils";
import type { LrnMatchResult, PendingStudent } from "./types";
import styles from "./lrn-verification.module.css";

const PROCESS_STEPS = [
  "Registrar clicks “Verify LRN” to open the verification overlay.",
  "The system looks up the claimed LRN against the official student records.",
  "Submitted applicant details are cross-checked against the matching record.",
  "The verdict (Verified / Mismatch / Not found) is shown to guide the decision.",
  "Registrar confirms the applicant's identity before approving the account.",
];

type Props = {
  student: PendingStudent;
  onApprove: () => void;
  approving?: boolean;
};

export function LrnVerifyButton({ student, onApprove, approving }: Props) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "done"; data: LrnMatchResult }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const trimmed = student.lrn.trim();

  const run = React.useCallback(() => {
    if (!trimmed || trimmed === "—") {
      setState({ status: "error", message: "No LRN was provided at sign-up." });
      return;
    }
    setState({ status: "loading" });
    apiClient
      .get<LrnMatchResult>("/api/auth/match-lrn", {
        params: { lrn: trimmed, name: student.name },
      })
      .then((res) => setState({ status: "done", data: res.data }))
      .catch((err: unknown) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Verification failed. Please try again.";
        setState({ status: "error", message });
      });
  }, [trimmed, student.name]);

  const openModal = () => {
    setOpen(true);
    setState({ status: "idle" });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={openModal}
        aria-label={`Verify LRN for ${student.name}`}
      >
        <Fingerprint className="size-3.5" aria-hidden />
        Verify LRN
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>LRN Verification</DialogTitle>
            <DialogDescription>
              Cross-check {student.name}&apos;s submitted details against the
              official student records before approving.
            </DialogDescription>
          </DialogHeader>

          {state.status === "idle" ? (
            <IdleState onRun={run} disabled={!trimmed || trimmed === "—"} />
          ) : state.status === "loading" ? (
            <div className={styles.loading}>
              <Loader2 className={styles.spinner} aria-hidden />
              <span className={styles.loadingText}>
                Looking up {trimmed} against student records…
              </span>
            </div>
          ) : state.status === "error" ? (
            <p className={styles.hint} style={{ borderColor: "#dc2626", color: "#b91c1c" }}>
              {state.message}
            </p>
          ) : (
            <Result
              data={state.data}
              onRecheck={run}
              onApprove={onApprove}
              approving={approving}
              onDone={() => setOpen(false)}
            />
          )}

          <DialogFooter showCloseButton>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IdleState({
  onRun,
  disabled,
}: {
  onRun: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className={styles.process}>
        <h3 className={styles.processTitle}>How verification works</h3>
        <ol className={styles.steps}>
          {PROCESS_STEPS.map((text, i) => (
            <li key={i} className={styles.step}>
              <span className={styles.stepNum}>{i + 1}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex items-center justify-between rounded-lg border px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{disabled ? "No LRN on record" : "Ready to verify"}</p>
          <p className="truncate text-xs text-muted-foreground">Claimed LRN: {disabled ? "—" : "•".repeat(5)}</p>
        </div>
        <Button size="sm" className="gap-1.5" disabled={disabled} onClick={onRun}>
          <Fingerprint className="size-4" aria-hidden />
          Run verification
        </Button>
      </div>
    </div>
  );
}

function Result({
  data,
  onRecheck,
  onApprove,
  approving,
  onDone,
}: {
  data: LrnMatchResult;
  onRecheck: () => void;
  onApprove: () => void;
  approving?: boolean;
  onDone: () => void;
}) {
  const verdict = data.verdict;
  const match = verdict === "match";
  const mismatch = verdict === "mismatch";
  const notFound = verdict === "not_found";

  const verdictClass = match
    ? styles.verdictMatch
    : mismatch
      ? styles.verdictMismatch
      : styles.verdictNotFound;
  const verdictLabel = match
    ? "Identity confirmed"
    : mismatch
      ? "Details do not match"
      : "LRN not in records";
  const verdictIcon = match ? (
    <ShieldCheck className="size-4" aria-hidden />
  ) : mismatch ? (
    <ShieldAlert className="size-4" aria-hidden />
  ) : (
    <ShieldX className="size-4" aria-hidden />
  );

  const roster = data.roster;

  return (
    <div className="flex flex-col gap-4">
      <div className={`${styles.verdict} ${verdictClass}`}>
        {verdictIcon}
        <span>{verdictLabel}</span>
      </div>

      {/* Cross-verification comparison */}
      <section>
        <h3 className={styles.sectionLabel}>Cross-verification</h3>
        <div className={styles.compareCard}>
          <div className={styles.compareHead}>
            <span className={styles.compareCol}>Submitted</span>
            <span className={styles.compareCol}>Official record</span>
          </div>

          <CompareRow
            label="LRN"
            submitted={data.claimedLrn}
            record={roster ? roster.lrn : "— not found —"}
            ok={data.lrnMatch}
            showBadge
          />
          <CompareRow
            label="Name"
            submitted="as submitted"
            record={roster ? roster.fullName : "—"}
            ok={data.nameMatch}
            note={roster ? `${Math.round((data.nameSimilarity ?? 0) * 100)}% similar` : undefined}
          />
          <CompareRow
            label="Grade / Section"
            submitted="claimed"
            record={roster ? `${formatGrade(roster.gradeLevel)}${roster.section ? ` · ${formatSection(roster.section)}` : ""}` : "—"}
            ok={match}
          />
        </div>
      </section>

      {verdict !== "match" ? (
        <p className={styles.hint}>
          Registrar: confirm with the official SF10 / enrollment record before approving.
        </p>
      ) : null}

      {match ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={approving}
            onClick={() => {
              onApprove();
              onDone();
            }}
          >
            {approving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            Approve account
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRecheck} disabled={approving}>
            <RefreshCw className="size-3.5" aria-hidden />
            Re-check
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="self-start gap-1.5" onClick={onRecheck}>
          <RefreshCw className="size-3.5" aria-hidden />
          Re-check
        </Button>
      )}
    </div>
  );
}

function CompareRow({
  label,
  submitted,
  record,
  ok,
  note,
  showBadge,
}: {
  label: string;
  submitted: string;
  record: string;
  ok: boolean;
  note?: string;
  showBadge?: boolean;
}) {
  return (
    <div className={styles.compareRow}>
      <span className={styles.value}>
        {label}: <span className={showBadge || !ok ? (ok ? styles.ok : styles.bad) : styles.valueMuted}>{submitted}</span>
        {note ? <span className={`block text-[11px] ${ok ? styles.ok : styles.bad}`}>{ok ? "✓ match" : `≈ ${note}`}</span> : null}
      </span>
      <span className={styles.value}>
        {record}
        <span className="block pt-0.5">
          {ok ? (
            <Badge variant="outline" className="gap-1 border-green-500/30 bg-green-500/10 text-green-600 text-[10px] font-semibold">
              <CircleCheck className="size-3" aria-hidden />
              Match
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-destructive/30 bg-destructive/10 text-destructive text-[10px] font-semibold">
              <CircleX className="size-3" aria-hidden />
              No match
            </Badge>
          )}
        </span>
      </span>
    </div>
  );
}
