"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import { Button } from "@/components/ui/button";
import { AdmTrackingTimeline } from "@/components/adm-tracker/AdmTrackingTimeline";
import type { TrackerCaseInput } from "@/components/adm-tracker/adm-stage-activity";

export interface TrackableReferral {
  id: string;
  studentName: string;
  lrn: string;
  targetRole: string;
  track: "adm" | "general";
  typeLabel: string;
  typeVariant: "amber" | "blue" | "green" | "outline";
  status: string;
  statusLabel: string;
  statusVariant: "amber" | "blue" | "green" | "red" | "outline";
  referredAt: string;
  reason: string;
  timeline: {
    label: string;
    detail?: string | null;
    date: string;
    at?: string;
    action?: string;
    byRole?: string | null;
    source?: "referrals" | "counseling_sessions" | "adm_parent_meetings" | "case";
    stage?: string | null;
    homeVisit?: boolean;
  }[];
  consultReviewer?: string | null;
  admStage?: string | null;
  dismissedByRole?: string | null;
  observationDate?: string | null;
  meetingAttended?: boolean | null;
  lastMeetingAt?: string | null;
  hasHomeVisit?: boolean;
  admApproved?: boolean;
  admApprovedAt?: string | null;
  modulesSubmitted?: number;
  modulesTotal?: number;
  lastModuleAt?: string | null;
  devicesReturned?: number;
  certificationAt?: string | null;
  resolvedAt?: string | null;
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${d.toTimeString().slice(0, 5)}`;
}

const VARIANT_DOT: Record<string, string> = {
  amber: "#f59e0b",
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  outline: "var(--muted-foreground)",
};

const REVIEWER_LABELS: Record<string, string> = {
  nurse: "School Nurse",
  guidance_counselor: "Guidance Counselor",
  lrpc: "LRPC",
};

/** ADM stages where the case still sits with the consultation reviewer. */
const EARLY_ADM_STAGES = new Set(["anecdotal", "consultation"]);

export function ReferralTrackDialog({
  referral,
  onClose,
}: {
  referral: TrackableReferral | null;
  onClose: () => void;
}) {
  const open = referral !== null;
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLOListElement | null>(null);
  const isAdmTrack = referral?.track === "adm";
  const trackInput: TrackerCaseInput | null =
    referral && isAdmTrack
      ? {
          stage: referral.admStage ?? null,
          referralStatus: referral.status,
          dismissedByRole: referral.dismissedByRole ?? null,
          consultReviewer: referral.consultReviewer ?? null,
          referredBy: null,
          anecdotalDate: referral.observationDate ?? null,
          referredDate: referral.referredAt,
          meetingAttended: referral.meetingAttended ?? null,
          lastMeetingAt: referral.lastMeetingAt ?? null,
          hasHomeVisit: referral.hasHomeVisit ?? false,
          approved: referral.admApproved ?? false,
          approvedAt: referral.admApprovedAt ?? null,
          modulesSubmitted: referral.modulesSubmitted ?? 0,
          modulesTotal: referral.modulesTotal ?? 0,
          lastModuleAt: referral.lastModuleAt ?? null,
          devicesReturned: referral.devicesReturned ?? 0,
          certificationAt: referral.certificationAt ?? null,
          resolvedAt: referral.resolvedAt ?? null,
          timeline: (referral.timeline ?? []).map((t) => ({
            label: t.label,
            detail: t.detail ?? null,
            date: t.date,
            at: t.at ?? t.date,
            action: t.action ?? "",
            byRole: t.byRole ?? null,
            source: t.source ?? "case",
            stage: t.stage ?? null,
            homeVisit: t.homeVisit ?? false,
          })),
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
  }, [open ]);

  if (!open || !mounted || !referral) return null;

  const dot = VARIANT_DOT[referral.statusVariant] ?? "var(--muted-foreground)";
  const withReviewer =
    referral.targetRole === "adm_coordinator" &&
    !!referral.consultReviewer &&
    EARLY_ADM_STAGES.has(referral.admStage ?? "consultation");
  const deskNow =
    withReviewer && referral.consultReviewer
      ? (REVIEWER_LABELS[referral.consultReviewer] ?? humanize(referral.consultReviewer))
      : humanize(referral.targetRole);

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
        aria-labelledby="referral-track-title"
        tabIndex={-1}
        className={`flex max-h-[calc(100dvh-2rem)] w-full min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-muted p-2.5 shadow-xl [font-family:var(--font-inter)] animate-in fade-in-0 zoom-in-95 duration-150 dark:bg-background ${isAdmTrack ? "max-w-4xl" : "max-w-2xl"}`}
      >
        <div className="-mx-2.5 flex min-w-0 items-start gap-1.5 border-b border-border px-3.5 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id="referral-track-title" className="truncate text-[13px] font-semibold">
              Track referral
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {referral.studentName} · {referral.lrn}
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
          <span
            className="inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight"
            style={{
              color: dot,
              borderColor: `color-mix(in srgb, ${dot} 40%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${dot} 12%, transparent)`,
            }}
            title={referral.statusLabel}
          >
            {referral.statusLabel}
          </span>
          <span
            className="inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-xs font-semibold leading-tight"
            style={{
              color: "#f59e0b",
              borderColor: "color-mix(in srgb, #f59e0b 40%, transparent)",
              backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)",
            }}
            title={referral.typeLabel}
          >
            {referral.typeLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">to {deskNow}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 px-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <History size={14} aria-hidden />
            {isAdmTrack ? "Pipeline tracking" : "Case history"}
          </p>
          {isAdmTrack && trackInput ? (
            <AdmTrackingTimeline input={trackInput} variant="cards" />
          ) : referral.timeline.length > 0 ? (
            <div className="relative">
              <ol
                ref={listRef}
                className="flex max-h-48 min-w-0 flex-col gap-4 overflow-y-auto pr-1 pb-8"
              >
                {referral.timeline.map((step, index) => (
                  <li
                    key={`${step.label}-${step.date}-${index}`}
                    className="relative flex gap-3 pl-5 before:absolute before:top-5 before:bottom-[-1rem] before:left-[3px] before:w-px before:bg-border last:before:hidden"
                  >
                    <span
                      className="absolute top-1.5 left-0 h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug font-medium">{step.label}</p>
                      {step.detail ? (
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {step.detail}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(step.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-white via-white/85 to-transparent pt-8 pb-1 dark:from-card dark:via-card/85">
                <ScrollDownHint
                  scrollRef={listRef}
                  watchKey={referral?.id}
                  always
                  className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No history recorded yet.
            </p>
          )}
        </div>
        {isAdmTrack && trackInput ? null : (
          <div className="-mx-2.5 flex justify-end gap-2 border-t border-border px-3.5 pt-2">
            <Button
              type="button"
              variant="outline"
              className="h-6 px-2.5 text-xs"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
