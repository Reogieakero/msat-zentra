"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildAdmTrackSteps,
  type AdmTrackInput,
} from "./adm-track-data";
import styles from "./adm-track-dialog.module.css";

export interface AdmTrackCase {
  student: string;
  lrn: string;
  section: string;
  reason?: string | null;
}

/**
 * Track ADM referral — read-only timeline from the very start of the case:
 * the adviser filing the anecdotal report, the referral to the picked
 * consultation reviewer (nurse or guidance), then every backend ADM
 * pipeline stage through completion. Status-only; no clinical detail.
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
  const steps = React.useMemo(() => buildAdmTrackSteps(track), [track]);
  const current = steps.find((s) => s.state === "current") ?? steps[steps.length - 1];
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [showScrollDown, setShowScrollDown] = React.useState(false);

  // Labeled scroll-down pill (same as the guidance interventions sheets):
  // visible only while more stages sit below the fold. Re-measured on
  // open, on scroll, on resize, and whenever the viewport itself resizes.
  const updateScrollBtn = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setShowScrollDown(false);
      return;
    }
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 40);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updateScrollBtn();
    window.addEventListener("resize", updateScrollBtn);
    const el = scrollRef.current;
    if (el && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateScrollBtn());
      observer.observe(el);
      return () => {
        window.removeEventListener("resize", updateScrollBtn);
        observer.disconnect();
      };
    }
    return () => window.removeEventListener("resize", updateScrollBtn);
  }, [open, updateScrollBtn, steps]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Track ADM referral — {caseInfo.student}</DialogTitle>
          <DialogDescription>
            {caseInfo.lrn} · {caseInfo.section} · {current.order} of 8 · {current.label} ({current.owner})
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} onScroll={updateScrollBtn} className={styles.scrollArea}>
          <p className={styles.summary}>
            <span className={styles.summaryStrong}>How this case started: </span>
            the adviser filed the anecdotal report
            {track.referredBy ? ` (${track.referredBy})` : ""}, then referred it for
            consultation. Only the picked reviewer acts at consultation —{" "}
            {steps[1].owner} — before the ADM coordinator takes the parent
            meeting onward.
            {caseInfo.reason ? ` Reason: ${caseInfo.reason}` : ""}
          </p>

          <ol className={styles.timeline} aria-label={`ADM pipeline for ${caseInfo.student}`}>
            {steps.map((step) => {
              const done = step.state === "done";
              const isCurrent = step.state === "current";
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
                        <Badge variant="secondary">Done</Badge>
                      ) : isCurrent ? (
                        <Badge variant="default">Current</Badge>
                      ) : (
                        <Badge variant="outline">Upcoming</Badge>
                      )}
                    </div>
                    <p className={styles.detail}>{step.detail}</p>
                    <p className={styles.owner}>Owner: {step.owner}</p>
                    <p className={styles.desc}>{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {showScrollDown && (
            <button
              type="button"
              className={styles.scrollDownBtn}
              onClick={() =>
                scrollRef.current?.scrollBy({
                  top: Math.max(
                    200,
                    (scrollRef.current?.clientHeight ?? 400) * 0.8
                  ),
                  behavior: "smooth",
                })
              }
            >
              <ChevronDown aria-hidden="true" />
              Scroll down
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
