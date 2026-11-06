"use client";
import * as React from "react";
import { Check, ClipboardCheck, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FormDropdown } from "../../referrals/components/form-dropdown";
import type { AtRiskStudentItem, InterventionOutcome } from "@/services/guidance/interventions.types";
import { Busy } from "./busy";

function CheckRow({
  done,
  label,
  right,
}: {
  done: boolean;
  label: string;
  right: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          done
            ? "bg-green-600 dark:bg-green-500"
            : "border-2 border-slate-300 dark:border-[#46464e]"
        )}
      >
        {done && <Check className="size-3 text-white dark:text-[#0f2a1c]" strokeWidth={3.5} />}
      </span>
      <span className="min-w-0 flex-1 text-sm text-slate-900 dark:text-[#f4f4f5]">
        <span className="sr-only">{done ? "Done: " : "Pending: "}</span>
        {label}
      </span>
      <span className="shrink-0 text-[13px] text-slate-500 dark:text-[#a1a1aa]">
        {right}
      </span>
    </div>
  );
}

export function InterventionOutcomeDialog({
  open,
  onClose,
  activeRow,
  followUp,
  outcomeStatus,
  onOutcomeStatus,
  outcomeNotes,
  onOutcomeNotes,
  isActionPending,
  onSubmit,
  canSubmit,
}: {
  open: boolean;
  onClose: () => void;
  activeRow: AtRiskStudentItem | null;
  followUp: AtRiskStudentItem["intervention"];
  outcomeStatus: InterventionOutcome;
  onOutcomeStatus: (v: InterventionOutcome) => void;
  outcomeNotes: string;
  onOutcomeNotes: (v: string) => void;
  isActionPending: boolean;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  const noteRef = React.useRef<HTMLTextAreaElement | null>(null);
  if (!open) return null;
  const finished = followUp?.completedSessions ?? 0;
  const total = followUp?.sessions.length ?? 0;
  const noLongerAtRisk =
    !!followUp &&
    activeRow?.riskLevel === "Low" &&
    followUp.approvalStatus !== "pending";
  const sessionsDone = finished > 0 || noLongerAtRisk;
  const noteAdded = outcomeNotes.trim() !== "";
  const isClosed = activeRow?.intervention?.outcomeStatus === "resolved";
  return (
    <CardModal
      open
      onClose={() => {
        if (!isActionPending) onClose();
      }}
      dismissable={!isActionPending}
      size="md"
      initialFocusRef={noteRef}
      title={
        <span className="flex items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <ClipboardCheck className="size-5" aria-hidden />
          </span>
          Record the outcome
        </span>
      }
      description="Close out this follow-up with a closing note."
      watchKey={`${finished}-${total}-${outcomeNotes.length}`}
    >
      <div aria-busy={isActionPending || undefined} className="flex flex-col gap-5">
        {isClosed && (
          <div
            role="status"
            className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-sm leading-5 text-blue-800 dark:border-[#1e3a6e] dark:bg-[#0f1a33] dark:text-[#bfdbfe]"
          >
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              This follow-up is closed — you can still update the closing notes
              below. The status stays resolved.
            </p>
          </div>
        )}

        <div className="rounded-[14px] border border-slate-200 p-3.5 dark:border-[#2f2f35]">
          <p className="text-[11px] font-medium uppercase leading-[14px] tracking-[0.06em] text-slate-500 dark:text-[#a1a1aa]">
            To close
          </p>
          <div className="mt-2.5 flex flex-col gap-2.5">
            <CheckRow
              done={sessionsDone}
              label="At least one finished session"
              right={
                noLongerAtRisk
                  ? "Not required"
                  : `${finished} of ${total} finished`
              }
            />
            <CheckRow
              done={noteAdded}
              label="A closing note"
              right={noteAdded ? "Added" : "Required"}
            />
          </div>
        </div>
        <p className="-mt-3 text-[13px] leading-[18px] text-slate-500 dark:text-[#a1a1aa]">
          No longer at risk? The follow-up can be discontinued with a closing
          note alone.
        </p>

        <div className="[&_button]:h-[42px] [&_button]:rounded-[10px]">
          <div className="relative">
            <FormDropdown
              id="outcomeStatus"
              label="Where does this stand?"
              value={outcomeStatus}
              onChange={(v) => onOutcomeStatus(v as InterventionOutcome)}
              placeholder="Pick a status"
              options={[
                { value: "ongoing", label: "Still ongoing" },
                { value: "resolved", label: "Resolved — goal met" },
                { value: "unresolved", label: "Closed — not resolved" },
              ]}
              disabled={isClosed}
            />
            {isClosed && (
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-[10px] right-10 flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300"
              >
                <Lock className="size-3" />
                Locked
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="outcomeNotes">Progress note</Label>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">
              Required when closing
            </span>
          </div>
          <Textarea
            id="outcomeNotes"
            ref={noteRef}
            rows={4}
            value={outcomeNotes}
            onChange={(e) => onOutcomeNotes(e.target.value)}
            placeholder="What happened, and why is this case closing?"
            maxLength={2000}
            className="mt-1.5 resize-none rounded-[10px] text-sm leading-5 focus-visible:border-blue-400 focus-visible:ring-blue-400/25"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 -mx-5 -mb-5 dark:border-white/10">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isActionPending}
            className="h-8 rounded-[8px] px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            aria-busy={isActionPending || undefined}
            className="h-8 rounded-[8px] bg-[#2563eb] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
          >
            <Busy busy={isActionPending} />
            {isActionPending ? "Saving…" : "Save outcome"}
          </Button>
        </div>
      </div>
    </CardModal>
  );
}
