"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import {
  gradeLabel,
  stageOrder,
  type AdmCase,
} from "./adm-cases-data";
import { AdmTrackingTimeline } from "@/components/adm-tracker/AdmTrackingTimeline";
import type { TrackerCaseInput } from "@/components/adm-tracker/adm-stage-activity";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./AdmCaseDialog.module.css";

interface AdmCaseRailProps {
  caseData: AdmCase;
  onClose: () => void;
  onTrack: (caseData: AdmCase) => void;
}

/* Read-only case tracking in a right-side card: the official 8-stage ADM
   pipeline with the current position plus status-only facts. No clinical
   detail ever renders here. */
export function AdmCaseRail({ caseData, onClose, onTrack }: AdmCaseRailProps) {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const currentOrder = stageOrder(caseData.stage);
  // Same shared tracker input as the referrals track dialog — one output
  // on both pages. Filing/reviewer identity falls back (adviser filed it;
  // reviewer unknown on this list) and the audit timeline carries the rest.
  const trackInput: TrackerCaseInput = {
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
  };

  return (
    <div className={assign.card} aria-label={`Track ADM case for ${caseData.studentName}`}>
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{caseData.studentName} — tracking</h3>
          <p className="truncate text-xs text-muted-foreground">
            LRN {caseData.lrn} · {caseData.section} · {gradeLabel(caseData.gradeLevel)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close case tracking"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex items-center gap-2">
        <div
          className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round((currentOrder / 8) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall pipeline progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round((currentOrder / 8) * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          Stage {currentOrder} of 8
        </span>
      </div>

      {/* The 8-step timeline scrolls inside the card (same pattern as the
          referrals track dialog) with the shared scroll-down hint pinned
          under it — guaranteed visible whenever stages sit below the fold. */}
      <div ref={listRef} className={`relative ${styles.timelineScroll} pr-1`}>
        <AdmTrackingTimeline input={trackInput} />
      </div>
      <div className="flex justify-center pt-1">
        <ScrollDownHint
          scrollRef={listRef}
          watchKey={caseData.id}
          label="Scroll down"
          className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
        />
      </div>

      <div className="relative flex justify-end">
        <Button type="button" size="sm" onClick={() => onTrack(caseData)}>
          Track in referrals
        </Button>
      </div>
    </div>
  );
}
