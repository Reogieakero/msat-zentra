"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import {
  REASON_LABELS,
  STATUS_LABELS,
  formatAge,
  type GradeFlagRow,
} from "./grade-flags-data";
import styles from "./FlagDetailDialog.module.css";

const STATUS_VARIANTS = {
  open: "warning",
  escalated: "destructive",
  resolved: "success",
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface FlagDetailDialogProps {
  flag: GradeFlagRow | null;
  onClose: () => void;
  onResolve?: (flag: GradeFlagRow) => void;
}

export function FlagDetailDialog({ flag, onClose, onResolve }: FlagDetailDialogProps) {
  return (
    <Dialog
      open={flag !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className={styles.dialog}>
        {flag ? (
          <>
            <DialogHeader>
              <div className={styles.titleRow}>
                <DialogTitle className={styles.title}>{flag.student.name}</DialogTitle>
                <Badge variant={STATUS_VARIANTS[flag.status]}>
                  {STATUS_LABELS[flag.status]}
                </Badge>
              </div>
              <DialogDescription className={styles.subtitle}>
                {flag.student.lrn} · {flag.subject.name} · {flag.section.name} · Term{" "}
                {flag.term.termNumber}
              </DialogDescription>
            </DialogHeader>

            <div className={styles.reasonRow}>
              <Badge variant="outline">{REASON_LABELS[flag.reason]}</Badge>
              <span className={styles.raisedOn}>Raised {formatDate(flag.createdAt)}</span>
            </div>

            {flag.note ? <p className={styles.note}>&ldquo;{flag.note}&rdquo;</p> : null}

            <dl className={styles.meta}>
              <div className={styles.metaRow}>
                <dt>Raised by</dt>
                <dd>{flag.raisedBy.fullName}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Gradebook owner</dt>
                <dd>{flag.owner?.fullName ?? "Unassigned"}</dd>
              </div>
              <div className={styles.metaRow}>
                <dt>Status age</dt>
                <dd>
                  {flag.status === "resolved"
                    ? `Resolved ${formatDate(flag.resolvedAt)}`
                    : formatAge(flag.ageDays)}
                </dd>
              </div>
              {flag.resolutionNote ? (
                <div className={styles.metaRow}>
                  <dt>Resolution</dt>
                  <dd>{flag.resolutionNote}</dd>
                </div>
              ) : null}
            </dl>

            <ol className={styles.timeline}>
              <li className={`${styles.step} ${styles.stepDone}`}>
                <span className={styles.stepDot} aria-hidden>
                  <Check className={styles.stepIcon} />
                </span>
                <span className={styles.stepText}>Raised · {formatDate(flag.createdAt)}</span>
              </li>
              {flag.escalatedAt ? (
                <li className={`${styles.step} ${styles.stepDone}`}>
                  <span className={styles.stepDot} aria-hidden>
                    <Check className={styles.stepIcon} />
                  </span>
                  <span className={styles.stepText}>
                    Escalated · {formatDate(flag.escalatedAt)}
                  </span>
                </li>
              ) : null}
              <li
                className={`${styles.step} ${
                  flag.status === "resolved" ? styles.stepDone : styles.stepTodo
                }`}
              >
                <span className={styles.stepDot} aria-hidden>
                  {flag.status === "resolved" ? (
                    <Check className={styles.stepIcon} />
                  ) : null}
                </span>
                <span className={styles.stepText}>
                  {flag.status === "resolved"
                    ? `Resolved · ${formatDate(flag.resolvedAt)}`
                    : "Waiting on gradebook owner"}
                </span>
              </li>
            </ol>

            {onResolve && flag.status !== "resolved" ? (
              <Button
                type="button"
                variant="outline"
                className={styles.resolveBtn}
                onClick={() => onResolve(flag)}
              >
                Resolve flag
              </Button>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
