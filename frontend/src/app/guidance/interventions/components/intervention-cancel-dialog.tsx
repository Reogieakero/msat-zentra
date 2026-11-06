"use client";
import * as React from "react";
import { Calendar, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatTime } from "@/lib/labels/datetime";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import type { CounselingSessionItem } from "@/services/guidance/interventions.types";

export function InterventionCancelDialog({
  open,
  onClose,
  activeSession,
  isActionPending,
  onSubmit,
  serverError = null,
}: {
  open: boolean;
  onClose: () => void;
  activeSession: CounselingSessionItem | null;
  isActionPending: boolean;
  onSubmit: (reason?: string) => void;
  serverError?: string | null;
}) {
  const [reason, setReason] = React.useState("");
  const keepRef = React.useRef<HTMLButtonElement | null>(null);

  const openKey = open ? (activeSession?.id ?? "new") : null;
  const [prevOpenKey, setPrevOpenKey] = React.useState<string | null>(null);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setReason("");
  }

  if (!open) return null;
  return (
    <CardModal
      open
      onClose={() => {
        if (!isActionPending) onClose();
      }}
      dismissable={!isActionPending}
      size="md"
      initialFocusRef={keepRef}
      title={
        <span className="flex items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-[#2a1215] dark:text-[#fca5a5]">
            <TriangleAlert className="size-5" aria-hidden />
          </span>
          Cancel this session?
        </span>
      }
      description="This session will be cancelled."
      watchKey={activeSession?.id ?? "none"}
    >
      <div aria-busy={isActionPending || undefined} className="flex flex-col gap-4">
        {activeSession && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 dark:border-[#2f2f35] dark:bg-[#1f1f23]">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300">
              <Calendar className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5 text-slate-900 dark:text-[#f4f4f5]">
                {sessionTypeLabel(activeSession.sessionType)}
              </p>
              <p className="mt-0.5 text-[13px] leading-[18px] text-slate-500 dark:text-[#a1a1aa]">
                {formatDate(activeSession.date)} · {formatTime(activeSession.scheduledAt)}
              </p>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="iv-cancel-reason">
            Why? <span className="font-normal text-slate-500 dark:text-[#a1a1aa]">(optional)</span>
          </Label>
          <Textarea
            id="iv-cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for cancelling…"
            maxLength={500}
            className="mt-1.5 resize-none rounded-[10px] text-sm leading-5 focus-visible:border-blue-400 focus-visible:ring-blue-400/25"
          />
        </div>

        {serverError ? (
          <p role="alert" className="-mt-1 text-[13px] leading-5 text-red-700 dark:text-[#fca5a5]">
            {serverError}
          </p>
        ) : null}

        <div className="-mx-5 -mb-5 flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-white/10">
          <Button
            type="button"
            variant="outline"
            ref={keepRef}
            onClick={onClose}
            disabled={isActionPending}
            className="h-8 rounded-[8px] px-4"
          >
            Keep session
          </Button>
          <Button
            type="button"
            onClick={() => onSubmit(reason.trim() ? reason.trim() : undefined)}
            disabled={isActionPending}
            aria-busy={isActionPending || undefined}
            className="h-8 rounded-[8px] bg-[#dc2626] px-4 text-sm font-semibold text-white hover:bg-[#b91c1c]"
          >
            {isActionPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {isActionPending ? "Cancelling…" : "Cancel session"}
          </Button>
        </div>
      </div>
    </CardModal>
  );
}
