"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderCard } from "@/components/ui/FolderCard";
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
      <Dialog
        open={flow.confirmFiling}
        onOpenChange={flow.setConfirmFiling}
      >
        <DialogContent className={styles.confirmDialog}>
          <DialogHeader>
            <DialogTitle>File this record?</DialogTitle>
            <DialogDescription>
              This creates the anecdotal record and autofills GCForm-01. This is how it will be filed:
            </DialogDescription>
          </DialogHeader>
          {reviewPreview ? (
            <div className={styles.confirmFolder}>
              <FolderCard
                label={reviewPreview.studentName}
                sublabel={`${reviewPreview.category} · ${reviewPreview.observationDateTime}`}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => flow.setConfirmFiling(false)}>
              Keep editing
            </Button>
            <Button
              type="button"
              onClick={() => {
                flow.setConfirmFiling(false);
                void flow.fileRecord();
              }}
            >
              File record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
