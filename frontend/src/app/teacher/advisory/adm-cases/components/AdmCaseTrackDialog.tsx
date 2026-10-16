"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdmTrackingTimeline } from "@/components/adm-tracker/AdmTrackingTimeline";
import type { TrackerCaseInput } from "@/components/adm-tracker/adm-stage-activity";
import { gradeLabel, stageColor } from "@/services/teacher/admCases.labels";
import type { AdmCase } from "@/services/teacher/admCases.types";

export function AdmCaseTrackDialog({
  caseData,
  onClose,
}: {
  caseData: AdmCase | null;
  onClose: () => void;
}) {
  const open = caseData !== null;
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const trackInput: TrackerCaseInput | null = caseData
    ? {
        stage: caseData.stage,
        referralStatus: caseData.referralStatus,
        consultReviewer: caseData.consultReviewer ?? null,
        referredBy: null,
        anecdotalDate: null,
        referredDate: caseData.datePrepared,
        meetingAttended: caseData.meetingAttended,
        lastMeetingAt: caseData.lastMeetingAt ?? null,
        hasHomeVisit: caseData.hasHomeVisit,
        approved: caseData.approved,
        approvedAt: caseData.approvedAt,
        modulesSubmitted: caseData.modulesSubmitted,
        modulesTotal: caseData.modulesTotal,
        lastModuleAt: caseData.lastModuleAt ?? null,
        devicesReturned: caseData.devicesReturned,
        certificationIssued: caseData.certificationIssued,
        certificationAt: caseData.certificationAt ?? null,
        timeline: caseData.timeline ?? [],
      }
    : null;

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

  if (!open || !mounted || !caseData) return null;

  const dot = stageColor(caseData.stage);

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
        aria-labelledby="adm-case-track-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-muted p-2.5 shadow-xl [font-family:var(--font-inter)] animate-in fade-in-0 zoom-in-95 duration-150 dark:bg-background"
      >
        <div className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id="adm-case-track-title" className="truncate text-[13px] font-semibold">
              Track ADM case
            </h2>
          </div>
          <span
            className="inline-flex max-w-40 shrink-0 items-center truncate rounded-md border px-2 py-0.5 text-xs font-semibold leading-tight"
            style={{
              color: "#f59e0b",
              borderColor: "color-mix(in srgb, #f59e0b 40%, transparent)",
              backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)",
            }}
            title={caseData.studentName}
          >
            {caseData.studentName}
          </span>
          <span
            className="inline-flex shrink-0 items-center truncate rounded-md border px-2 py-0.5 text-xs font-semibold leading-tight"
            style={{
              color: "#f59e0b",
              borderColor: "color-mix(in srgb, #f59e0b 40%, transparent)",
              backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)",
            }}
            title={`LRN ${caseData.lrn}`}
          >
            {caseData.lrn}
          </span>
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
          <span
            className="inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight"
            style={{
              color: dot,
              borderColor: `color-mix(in srgb, ${dot} 40%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${dot} 12%, transparent)`,
            }}
            title={caseData.stageLabel}
          >
            {caseData.stageLabel}
          </span>
          <span
            className="inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight"
            style={{
              color: "#f59e0b",
              borderColor: "color-mix(in srgb, #f59e0b 40%, transparent)",
              backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)",
            }}
            title={`${caseData.section} · ${gradeLabel(caseData.gradeLevel)}`}
          >
            {caseData.section} · {gradeLabel(caseData.gradeLevel)}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 px-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <History size={14} aria-hidden />
            Pipeline tracking
          </p>
          {trackInput ? (
            <AdmTrackingTimeline input={trackInput} variant="cards" />
          ) : (
            <p className="text-sm text-muted-foreground">
              No history recorded yet.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
