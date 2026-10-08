"use client";

import * as React from "react";
import { History } from "lucide-react";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import refStyles from "./referrals.module.css";
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

export function ReferralTrackDialog({
  referral,
  onClose,
}: {
  referral: TrackableReferral | null;
  onClose: () => void;
}) {
  const listRef = React.useRef<HTMLOListElement | null>(null);
  const isAdmTrack = referral?.track === "adm";
  const trackInput: TrackerCaseInput | null =
    referral && isAdmTrack
      ? {
          stage: referral.admStage ?? null,
          referralStatus: referral.status,
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

  return (
    <CardModal
      open={referral !== null}
      onClose={onClose}
      size="md"
      title="Track referral"
      description={
        referral ? (
          <>
            {referral.studentName} · {referral.lrn}
          </>
        ) : undefined
      }
      watchKey={referral?.id}
    >
        {referral ? (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={referral.statusVariant}>{referral.statusLabel}</Badge>
              <Badge variant={referral.typeVariant}>{referral.typeLabel}</Badge>
              <span className="text-sm text-muted-foreground">
                to {humanize(referral.targetRole)}
              </span>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Filing reason
              </p>
              <p className="mt-0.5 text-sm leading-relaxed">
                {referral.reason || "No reason recorded."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Submitted {formatDateTime(referral.referredAt)}
              </p>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <History size={14} aria-hidden />
                {isAdmTrack ? "Pipeline tracking" : "Case history"}
              </p>
              {isAdmTrack && trackInput ? (
                <AdmTrackingTimeline input={trackInput} />
              ) : referral.timeline.length > 0 ? (
                <>
                <div className="relative">
                <ol
                  ref={listRef}
                  className={`flex max-h-48 min-w-0 flex-col gap-4 overflow-y-auto pr-1 pb-8 ${refStyles.noScrollbar}`}
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
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-background via-background/85 to-transparent pt-8 pb-1">
                  <ScrollDownHint
                    scrollRef={listRef}
                    watchKey={referral?.id}
                    always
                    className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
                  />
                </div>
                </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No history recorded yet.
                </p>
              )}
            </div>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
    </CardModal>
  );
}
