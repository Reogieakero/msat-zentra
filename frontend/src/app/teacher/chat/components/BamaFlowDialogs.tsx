"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { FolderCard } from "@/components/ui/FolderCard";
import ThoughtLine from "@/components/ui/thought-line/ThoughtLine";
import { CATEGORY_COLORS } from "../../anecdotal/components/AnecdotalSideRail";
import type { BamaConversation } from "./bama-conversations";
import { CATEGORY_TONES } from "./bama-flow";
import type { AnecdotalFlow } from "./useAnecdotalFlow";
import styles from "./bama-flow-dialogs.module.css";

interface BamaFlowDialogsProps {
  flow: AnecdotalFlow;
  active: BamaConversation | null;
}

// Filing trace for the ThoughtLine — thresholds mirror filingStageFor in
// useAnecdotalFlow so steps tick in sync with the hook's progress.
const FILING_STEPS = ["Validating answers", "Filing anecdotal record", "Autofilling GCForm-01"];
const FILING_STEP_AT = [4, 30, 65];

export function BamaFlowDialogs({ flow, active }: BamaFlowDialogsProps) {
  const reviewPreview = active?.messages.find((m) => m.preview)?.preview ?? null;

  // Filing stages mirror the hook's progress thresholds — earlier steps tick,
  // the last one pulses until the record is filed.
  const filingSteps = FILING_STEPS.filter((_, i) => flow.fileProgress >= (FILING_STEP_AT[i] ?? 0));

  // Let the settle chord ("Record filed") play on success: the overlay stays
  // mounted briefly after filing flips false. Failures unmount at once.
  const [settleVisible, setSettleVisible] = useState(false);
  const settleTimer = useRef<number | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- settle-chord hold after filing flips false */
  useEffect(() => {
    if (flow.filing) {
      setSettleVisible(false);
      return;
    }
    if (active?.filed) {
      setSettleVisible(true);
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setSettleVisible(false), 650);
    }
    return () => {
      if (settleTimer.current !== null) {
        window.clearTimeout(settleTimer.current);
        settleTimer.current = null;
      }
    };
  }, [flow.filing, active?.filed]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <>
      <CardModal
        open={flow.confirmFiling}
        onClose={() => flow.setConfirmFiling(false)}
        title="File this record?"
        description="This creates the anecdotal record and autofills GCForm-01. This is how it will be filed:"
        size="sm"
        dismissable={!flow.filing}
        watchKey={reviewPreview?.studentName}
      >
        {reviewPreview ? (
          <div className={styles.confirmFolder}>
            <FolderCard
              label={reviewPreview.studentName}
              sublabel={`${reviewPreview.category} · ${reviewPreview.observationDateTime}`}
              folderColor={CATEGORY_COLORS[reviewPreview.category.toLowerCase()]}
              files={[
                {
                  name: "GCForm-01",
                  tag: reviewPreview.category,
                  tone: CATEGORY_TONES[reviewPreview.category.toLowerCase()] ?? 1,
                  icon: "doc",
                },
              ]}
            />
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => flow.setConfirmFiling(false)}>
            Keep editing
          </Button>
          <Button
            type="button"
            disabled={flow.filing}
            onClick={() => {
              flow.setConfirmFiling(false);
              void flow.fileRecord();
            }}
          >
            File record
          </Button>
        </div>
      </CardModal>

      {flow.filing || settleVisible ? (
        <div className={styles.filingOverlay} role="alertdialog" aria-modal="true" aria-label="Filing record">
          <div className={styles.filingCard}>
            <div className={styles.filingThought}>
              <ThoughtLine
                working={flow.filing}
                steps={filingSteps}
                label="Filing your record…"
                doneLabel="Record filed"
                fontSize={14}
                collapsible
                collapseOnSettle
                showTimer
              />
            </div>
            <p className={styles.filingHint}>Please wait — don&apos;t close this page.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
