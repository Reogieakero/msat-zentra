"use client";

import * as React from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { CERT_STATUS_META } from "@/services/coordinator/certifications.service";
import type { CertRecord } from "@/services/coordinator/certifications.types";

const STATUS_TONE = {
  prepared: "amber",
  awaiting: "blue",
  revision: "red",
  approved: "green",
} as const;

/**
 * Kanban-style confirmation overlay for "Endorse to Principal" (same pattern
 * as the other desk confirmations). Confirming closes the overlay at once
 * and the shared Dock in the bottom-right reports the request until it
 * settles.
 */
export function CoordinatorCertificationsEndorseConfirm({
  record,
  onConfirm,
  onClose,
}: {
  record: CertRecord;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const meta = CERT_STATUS_META[record.status];

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Endorse to Principal?"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-md">
        <KanbanBoard
          className="bg-card shadow-2xl"
          title="Endorse to Principal?"
          icon={
            <span className="text-primary" aria-hidden>
              <Send size={14} />
            </span>
          }
          actions={
            /* 24px close X — same as the other overlay kanbans. */
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={14} aria-hidden="true" />
            </button>
          }
          description={`${record.student}'s certification will be locked and sent to the Principal for final signature.`}
          footer={
            /* 24px action button — no Cancel; confirming closes at once. */
            <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
              <Button
                type="button"
                size="sm"
                className="h-6 px-3 text-xs"
                onClick={onConfirm}
                autoFocus
              >
                <Send aria-hidden />
                Endorse
              </Button>
            </div>
          }
        >
          <div className="flex items-center gap-2 px-1">
            <StudentMascot name={record.student} seed={record.lrn} size={32} />
            <span className="min-w-0 truncate text-sm font-semibold text-primary">
              {record.student}
            </span>
            <Pill tone="neutral" label="LRN" className="tabular-nums text-xs">
              {record.lrn}
            </Pill>
            <Pill tone="neutral" label="Grade level" className="text-xs">
              {record.grade || "—"}
            </Pill>
            <Pill
              tone={STATUS_TONE[record.status]}
              label="Certification status"
              className="text-xs"
            >
              {meta.label}
            </Pill>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            The folder locks and moves to Awaiting signature while the request
            settles.
          </p>
        </KanbanBoard>
      </div>
    </div>
  );
}
