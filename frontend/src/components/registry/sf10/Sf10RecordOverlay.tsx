"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sf10DetailContent,
  Sf10MetaToggles,
} from "@/components/registry/sf10/Sf10DetailView";
import styles from "./sf10.module.css";

/**
 * SF10 record overlay — the record report opens on top of the board/list
 * instead of navigating (the /{desk}/sf10/{id} route stays as the deep-link
 * fallback). Wide, scrollable; the body is the shared kanban-board report.
 */
export function Sf10RecordOverlay({
  desk,
  recordId,
  onClose,
}: {
  desk: "registrar" | "record-keeper";
  recordId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={recordId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 shadow-none sm:max-w-[72rem]">
        <div className="flex items-center justify-between gap-2 border-b border-border py-3 pr-12 pl-4">
          <DialogTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            SF10 Record Report
          </DialogTitle>
          {recordId ? <Sf10MetaToggles desk={desk} id={recordId} /> : null}
        </div>
        <DialogDescription className="sr-only">
          Record report — learner details, grade-by-grade subjects, actions, and history.
        </DialogDescription>
        <div
          className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ${styles.overlayScroll}`}
        >
          {recordId ? <Sf10DetailContent desk={desk} id={recordId} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
