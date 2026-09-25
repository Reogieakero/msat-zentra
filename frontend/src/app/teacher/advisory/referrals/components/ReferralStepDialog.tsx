"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReadMore } from "./ReadMore";
import styles from "./ReferralStepDialog.module.css";

export type WorkflowStepState = "done" | "current" | "todo";

export interface WorkflowStepInfo {
  key: string;
  label: string;
  sub: string;
  state: WorkflowStepState;
  optional?: boolean;
  owner?: string;
  description?: string;
  principalAction?: boolean;
  Icon: LucideIcon;
}

export interface StepTimelineEntry {
  label: string;
  date: string;
}

interface ReferralStepDialogProps {
  step: (WorkflowStepInfo & { index: number; total: number }) | null;
  timeline: StepTimelineEntry[];
  onClose: () => void;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Plain-words office names for non-technical readers.
const OFFICE_NAMES: Record<string, string> = {
  adm_coordinator: "ADM Coordinator",
  guidance_counselor: "Guidance Counselor",
  subject_teacher: "Subject Teacher",
  nurse: "Nurse",
  principal: "Principal",
  adviser: "Adviser",
  lrpc: "LRPC",
};

// Audit-trail labels can carry raw codes ("Referred to adm_coordinator",
// "… (consult reviewer: nurse)") — rewrite them into plain words.
function friendlyActivityLabel(label: string): string {
  let out = label ?? "";
  out = out.replace(/consult reviewer:\s*([A-Za-z_]+)/gi, (_, code: string) => {
    const friendly = OFFICE_NAMES[code.toLowerCase()] ?? code;
    return `reviewer: ${friendly}`;
  });
  out = out.replace(/\bReferred to ([A-Za-z_]+)/gi, (_, code: string) => {
    const friendly = OFFICE_NAMES[code.toLowerCase()];
    return friendly ? `Referred to ${friendly}` : `Referred to ${code}`;
  });
  out = out.replace(
    /\b(adm_coordinator|guidance_counselor|subject_teacher)\b/g,
    (m: string) => OFFICE_NAMES[m] ?? m
  );
  return out;
}

// One activity row: long entries truncate with "…" and get their own
// chevron toggle to expand the full text in place.
function ActivityItem({ label, date }: { label: string; date: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [label]);

  useEffect(() => {
    const el = labelRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollWidth > el.clientWidth + 1);
  }, [label, expanded]);

  return (
    <li className={`${styles.activityItem} ${expanded ? styles.activityExpanded : ""}`}>
      <span className={styles.activityDot} aria-hidden />
      <span ref={labelRef} className={styles.activityLabel} title={overflows && !expanded ? label : undefined}>
        {label}
      </span>
      <span className={styles.activityDate}>{formatDate(date)}</span>
      {overflows || expanded ? (
        <button
          type="button"
          className={styles.activityToggle}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Show less of this entry" : "Show full entry"}
        >
          {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </button>
      ) : null}
    </li>
  );
}

// Per-step detail overlay: what the step is, who owns it, its current
// status info, and the recorded activity (time, date, actions executed).
export function ReferralStepDialog({ step, timeline, onClose }: ReferralStepDialogProps) {
  const Icon = step?.Icon;
  const stateLabel =
    step?.state === "done" ? "Done" : step?.state === "current" ? "Current" : "Queued";
  const stateVariant =
    step?.state === "done" ? "success" : step?.state === "current" ? "default" : "secondary";

  return (
    <Dialog open={step !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={styles.dialog}>
        {step && Icon ? (
          <>
            <DialogHeader>
              <div className={styles.headRow}>
                <span className={styles.tile} aria-hidden>
                  <Icon />
                </span>
                <div className={styles.headText}>
                  <DialogTitle>{step.label}</DialogTitle>
                  <DialogDescription>
                    Step {step.index + 1} of {step.total}
                    {step.optional ? " · Optional" : ""}
                    {step.principalAction ? " · Principal action" : ""}
                  </DialogDescription>
                </div>
                <Badge variant={stateVariant}>{stateLabel}</Badge>
              </div>
            </DialogHeader>
            <dl className={styles.rows}>
              <div className={styles.row}>
                <dt className={styles.rowLabel}>Status</dt>
                <dd className={styles.rowValue}>{step.sub}</dd>
              </div>
              <div className={styles.row}>
                <dt className={styles.rowLabel}>Owner</dt>
                <dd className={styles.rowValue}>{step.owner ?? "—"}</dd>
              </div>
              {step.description ? (
                <div className={styles.row}>
                  <dt className={styles.rowLabel}>About this step</dt>
                  <dd className={styles.rowValue}>
                    <ReadMore text={step.description} maxLines={4} />
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className={styles.activity}>
              <p className={styles.activityHead}>Activity — time, date & actions executed</p>
              {timeline.length === 0 ? (
                <p className={styles.empty}>No activity recorded yet.</p>
              ) : (
                <ul className={styles.activityList}>
                  {timeline.map((t, i) => (
                    <ActivityItem
                      key={`${t.label}-${t.date}-${i}`}
                      label={friendlyActivityLabel(t.label)}
                      date={t.date}
                    />
                  ))}
                </ul>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
