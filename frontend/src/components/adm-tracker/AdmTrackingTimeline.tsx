"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  buildAdmTrackSteps,
} from "./adm-track-data";
import {
  formatActionTime,
  latestActionByStage,
  type TrackerCaseInput,
} from "./adm-stage-activity";
import styles from "./adm-tracking-timeline.module.css";

/* Shared ADM tracking timeline — one output on every teacher surface
   (adm-cases rail card + referrals track dialog): the 8 pipeline steps
   with state badges and owners, plus the latest action on each stage
   (who did what, when) so the adviser sees desk activity live, not just
   stage position. Status-only; no clinical detail ever renders here. */
export function AdmTrackingTimeline({
  input,
}: {
  input: TrackerCaseInput;
}) {
  // Small pure derivation (8 steps, one pass over the timeline) — computed
  // directly so fresh query data repaints live with no memo staleness.
  const steps = buildAdmTrackSteps({
    stage: input.stage ?? null,
    referralStatus: input.referralStatus ?? null,
    consultReviewer: input.consultReviewer ?? null,
    referredBy: input.referredBy ?? null,
    anecdotalDate: input.anecdotalDate ?? null,
    referredDate: input.referredDate ?? null,
    meetingAttended: input.meetingAttended ?? null,
    hasHomeVisit: input.hasHomeVisit ?? false,
    approved: input.approved ?? false,
    approvedAt: input.approvedAt ?? null,
  });
  const latestByStage = latestActionByStage(input);

  return (
    <ol className={styles.timeline} aria-label="ADM pipeline with latest actions">
      {steps.map((step) => {
        const done = step.state === "done";
        const isCurrent = step.state === "current";
        const latest = latestByStage[step.stage];
        return (
          <li key={step.stage} className={styles.step}>
            <span className={styles.rail} aria-hidden>
              <span
                className={`${styles.dot} ${done ? styles.dotDone : ""} ${isCurrent ? styles.dotCurrent : ""}`}
              >
                {done ? <Check className={styles.dotIcon} /> : null}
              </span>
              <span className={`${styles.line} ${done ? styles.lineLit : ""}`} />
            </span>
            <div className={styles.body}>
              <div className={styles.topRow}>
                <span className={styles.order}>Step {step.order}</span>
                <p className={`${styles.label} ${!done && !isCurrent ? styles.labelTodo : ""}`}>
                  {step.label}
                </p>
                {done ? (
                  <Badge variant="green">Done</Badge>
                ) : isCurrent ? (
                  <Badge variant="default">Current</Badge>
                ) : (
                  <Badge variant="outline">Upcoming</Badge>
                )}
              </div>
              <p className={styles.detail}>{step.detail}</p>
              <p className={styles.owner}>Owner: {step.owner}</p>
              <p className={styles.desc}>{step.description}</p>
              {latest ? (
                <p className={styles.latestAction}>
                  <span className={styles.latestLabel}>Latest action</span>
                  {latest.actor && !/ by /i.test(latest.text) ? ` — ${latest.actor}` : ""} · {latest.text}
                  {latest.detail ? ` — ${latest.detail}` : ""}
                  {latest.at ? ` · ${formatActionTime(latest.at)}` : ""}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
