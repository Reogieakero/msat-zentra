"use client";

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

export function AdmTrackingTimeline({
  input,
  reader = "teacher",
  variant = "timeline",
}: {
  input: TrackerCaseInput;
  reader?: "teacher" | "coordinator";
  /** "cards" renders one compact kanban card per step (label + owner
      pill + state pill) instead of the rail timeline. */
  variant?: "timeline" | "cards";
}) {
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
  const latestByStage = latestActionByStage(input, reader);

  if (variant === "cards") {
    const dismissalRole = input.dismissedByRole ?? null;
    const withdrawn =
      !dismissalRole || dismissalRole === "adviser" || dismissalRole === "subject_teacher";
    return (
      <ol
        className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="ADM pipeline steps"
      >
        {steps.map((step) => {
          const done = step.state === "done";
          const isCurrent = step.state === "current";
          // A pipeline that already ended at the current step shows its real
          // outcome instead of a perpetual "Current".
          const decision =
            isCurrent && input.referralStatus === "dismissed"
              ? { label: withdrawn ? "Cancelled" : "Rejected", color: "#ef4444" }
              : isCurrent && input.referralStatus === "resolved"
                ? { label: "Resolved", color: "#22c55e" }
                : null;
          // State accent tint (theme-safe via color-mix): done reads green,
          // the active step reads primary, ended steps read their outcome.
          const accent = decision?.color ?? (done ? "#22c55e" : isCurrent ? "var(--primary)" : null);
          return (
            <li
              key={step.stage}
              className={`flex min-w-0 flex-col gap-2 rounded-xl border p-2.5 ${
                accent ? "" : "border-border bg-muted/60 dark:bg-muted/20"
              }`}
              style={
                accent
                  ? {
                      borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`,
                    }
                  : undefined
              }
            >
              <div className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2">
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                  Step {step.order}
                </span>
                {decision ? (
                  <span
                    className="inline-flex h-6 shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight"
                    style={{
                      color: decision.color,
                      borderColor: `color-mix(in srgb, ${decision.color} 40%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${decision.color} 12%, transparent)`,
                    }}
                  >
                    {decision.label}
                  </span>
                ) : done ? (
                  <span
                    className="inline-flex h-6 shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight"
                    style={{
                      color: "#22c55e",
                      borderColor: "color-mix(in srgb, #22c55e 40%, transparent)",
                      backgroundColor: "color-mix(in srgb, #22c55e 12%, transparent)",
                    }}
                  >
                    Done
                  </span>
                ) : isCurrent ? (
                  <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold leading-tight text-primary-foreground">
                    Current
                  </span>
                ) : (
                  <span className="inline-flex h-6 shrink-0 items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium leading-tight text-secondary-foreground">
                    Upcoming
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-border bg-white p-2 text-left shadow-sm dark:bg-card">
                <span
                  className="line-clamp-2 min-h-10 text-xs/5 font-semibold text-foreground"
                  title={step.label}
                >
                  {step.label}
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex max-w-full items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium leading-tight text-secondary-foreground"
                    title={step.owner}
                  >
                    {step.owner}
                  </span>
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {step.detail}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

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
