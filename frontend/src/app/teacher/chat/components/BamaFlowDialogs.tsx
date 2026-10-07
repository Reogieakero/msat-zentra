"use client";

import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { FolderCard } from "@/components/ui/FolderCard";
import { CATEGORY_COLORS } from "../../anecdotal/components/AnecdotalSideRail";
import type { BamaConversation } from "./bama-conversations";
import { CATEGORY_TONES } from "./bama-flow";
import type { AnecdotalFlow } from "./useAnecdotalFlow";
import styles from "./bama-flow-dialogs.module.css";

interface BamaFlowDialogsProps {
  flow: AnecdotalFlow;
  active: BamaConversation | null;
}

export function BamaFlowDialogs({ flow, active }: BamaFlowDialogsProps) {
  const reviewPreview = active?.messages.find((m) => m.preview)?.preview ?? null;

  // Class / category / tier / datetime pickers render inline in the thread
  // (no overlay modals) — only the filing confirmation stays a dialog.
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

      {flow.filing ? (
        <div className={styles.filingOverlay} role="alertdialog" aria-modal="true" aria-label="Filing record">
          <div className={styles.filingCard}>
            <p className={styles.filingTitle}>Filing your record…</p>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${flow.fileProgress}%` }} />
            </div>
            <p className={styles.progressLabel}>
              {flow.fileStage} {flow.fileProgress}%
            </p>
            <p className={styles.filingHint}>Please wait — don&apos;t close this page.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
