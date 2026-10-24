"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdmTrackingTimeline } from "./AdmTrackingTimeline";
import type { TrackerCaseInput } from "./adm-stage-activity";
import {
  ADM_TRACK_STATUS_META,
  admTrackSummary,
  type AdmTrackInput,
} from "./adm-track-data";

export interface AdmTrackCase {
  student: string;
  lrn: string;
  section: string;
  reason?: string | null;
}

/**
 * Generic ADM track overlay: the same kanban board the teacher referral
 * tracker renders (`AdmTrackingTimeline` cards variant) plus the compact
 * referral header. Used from the nurse desk.
 */
export function AdmTrackDialog({
  open,
  onClose,
  caseInfo,
  track,
}: {
  open: boolean;
  onClose: () => void;
  caseInfo: AdmTrackCase;
  track: AdmTrackInput;
}) {
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  // The generic cards board reads a TrackerCaseInput; the desk input is a
  // strict subset apart from the dismissal actor and timeline fields.
  const input: TrackerCaseInput = {
    stage: track.stage ?? null,
    referralStatus: track.referralStatus ?? null,
    dismissedByRole: track.dismissedByRole || null,
    consultReviewer: track.consultReviewer ?? null,
    referredBy: track.referredBy ?? null,
    anecdotalDate: track.anecdotalDate ?? null,
    referredDate: track.referredDate ?? null,
    meetingAttended: track.meetingAttended ?? null,
    hasHomeVisit: track.hasHomeVisit ?? false,
    approved: track.approved ?? false,
    approvedAt: track.approvedAt ?? null,
  };
  const { holder } = admTrackSummary(track);
  const statusMeta = ADM_TRACK_STATUS_META[(track.referralStatus ?? "").toLowerCase()];
  const dot = statusMeta?.color ?? "var(--muted-foreground)";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-[2px] animate-in fade-in-0 duration-150 dark:bg-black/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adm-track-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-muted p-2.5 shadow-xl [font-family:var(--font-inter)] animate-in fade-in-0 zoom-in-95 duration-150 dark:bg-background"
      >
        <div className="-mx-2.5 flex min-w-0 items-start gap-1.5 border-b border-border px-3.5 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id="adm-track-title" className="truncate text-[13px] font-semibold">
              Track ADM referral
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {caseInfo.student} · {caseInfo.lrn}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-6 w-6 shrink-0 px-0"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={14} strokeWidth={1.8} aria-hidden />
          </Button>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 px-1">
          {statusMeta ? (
            <span
              className="inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight"
              style={{
                color: dot,
                borderColor: `color-mix(in srgb, ${dot} 40%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${dot} 12%, transparent)`,
              }}
              title={statusMeta.label}
            >
              {statusMeta.label}
            </span>
          ) : null}
          <span
            className="inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-xs font-semibold leading-tight"
            style={{
              color: "#f59e0b",
              borderColor: "color-mix(in srgb, #f59e0b 40%, transparent)",
              backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)",
            }}
            title="ADM case"
          >
            ADM case
          </span>
          <span className="text-[11px] text-muted-foreground">to {holder}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 px-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <History size={14} aria-hidden />
            Pipeline tracking
          </p>
          <AdmTrackingTimeline input={input} variant="cards" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
