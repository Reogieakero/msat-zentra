"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
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

/** Status tone carried by the shared Pill, same map as the referrals table. */
const VARIANT_TONE: Record<
  TrackableReferral["statusVariant"],
  "amber" | "blue" | "green" | "red" | "neutral"
> = {
  amber: "amber",
  blue: "blue",
  green: "green",
  red: "red",
  outline: "neutral",
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
  }, [open]);

  if (!open || !mounted || !referral) return null;

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
      {/* One shared shell for both referral types — Other matters uses the
          same board width, header pills and card grid as ADM cases. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="referral-track-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-muted p-2.5 shadow-xl [font-family:var(--font-inter)] animate-in fade-in-0 zoom-in-95 duration-150 dark:bg-background"
      >
        <div className="-mx-2.5 flex min-w-0 items-start gap-1.5 border-b border-border px-3.5 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id="referral-track-title" className="truncate text-[13px] font-semibold">
              Track referral
            </h2>
            <span className="mt-1 flex min-w-0 max-w-full flex-wrap items-center gap-1">
              <Pill tone="amber" label="Student" className="max-w-full overflow-hidden">
                <span className="truncate" title={referral.studentName}>
                  {referral.studentName}
                </span>
              </Pill>
              <Pill className="tabular-nums" label="LRN">
                {referral.lrn}
              </Pill>
            </span>
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
          <Pill tone={VARIANT_TONE[referral.statusVariant]} label="Referral status">
            {referral.statusLabel}
          </Pill>
          <Pill tone={isAdmTrack ? "amber" : "blue"} label="Referral type">
            {referral.typeLabel}
          </Pill>
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
            <ol
              className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Case history steps"
            >
              {referral.timeline.map((step, index) => (
                <li
                  key={`${step.label}-${step.date}-${index}`}
                  className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
                >
                  <div className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                      Update {index + 1}
                    </span>
                    <Pill label="Logged">{formatDateTime(step.date)}</Pill>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden rounded-lg border border-border bg-white p-2 shadow-sm dark:bg-card">
                    <span
                      className="line-clamp-2 min-h-10 text-xs/5 font-semibold text-foreground"
                      title={step.label}
                    >
                      {step.label}
                    </span>
                    {step.detail ? (
                      <span className="block min-w-0 break-all text-[11px] leading-snug text-muted-foreground">
                        {step.detail}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
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
