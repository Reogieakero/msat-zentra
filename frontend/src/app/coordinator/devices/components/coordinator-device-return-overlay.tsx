"use client";

import * as React from "react";
import { Loader2, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type { AdmDeviceRow } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-device-return-overlay.module.css";

/* Rectangle pills — same metric as the device board cards. */
const PILL_BASE =
  "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const PILL_SECONDARY = "border-border bg-secondary text-secondary-foreground";
const PILL_MUTED = "border-border bg-muted text-muted-foreground";

interface CoordinatorDeviceReturnOverlayProps {
  row: AdmDeviceRow | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Kanban-styled confirm overlay for recording a device return — muted board
 * shell + inner detail panel + pills, not the generic card modal. Only one
 * action (24px) sits in the footer; Esc or the backdrop dismisses it.
 */
export function CoordinatorDeviceReturnOverlay({
  row,
  pending,
  onClose,
  onConfirm,
}: CoordinatorDeviceReturnOverlayProps) {
  React.useEffect(() => {
    if (!row) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [row, pending, onClose]);

  if (!row) return null;

  return (
    <div className={styles.overlay}>
      <div
        className={styles.backdrop}
        onClick={() => {
          if (!pending) onClose();
        }}
        aria-hidden="true"
      />
      <div
        className={styles.board}
        role="dialog"
        aria-modal="true"
        aria-label="Record device return"
      >
        <div className={styles.head}>
          <span className={styles.headIcon} aria-hidden="true">
            <Undo2 size={15} />
          </span>
          <p className={styles.headTitle}>Record device return?</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 px-0"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
          >
            <X size={14} aria-hidden />
          </Button>
        </div>

        <div className={styles.body}>
          <div className={styles.studentRow}>
            <StudentMascot name={row.student} seed={row.lrn} size={32} />
            <p className={styles.studentName} title={row.student}>
              {row.student}
            </p>
            <Badge variant="amber" className="ml-auto shrink-0 rounded-md">
              Issued
            </Badge>
          </div>

          <div className={styles.pills}>
            <span className={`${PILL_BASE} ${PILL_SECONDARY}`}>
              {row.deviceType}
            </span>
            <span className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}>
              {row.deviceSerial}
            </span>
          </div>

          <div className={styles.pills}>
            <span className={`${PILL_BASE} ${PILL_MUTED}`}>{row.grade}</span>
            <span className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}>
              Issued {row.issuedDate}
            </span>
          </div>

          <p className={styles.note}>
            <Undo2 size={11} aria-hidden />
            This device will be marked returned today.
          </p>
        </div>

        <div className={styles.actions}>
          <Button
            size="sm"
            className="h-6 px-2.5 text-xs"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={onConfirm}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : null}
            {pending ? "Recording…" : "Record return"}
          </Button>
        </div>
      </div>
    </div>
  );
}
