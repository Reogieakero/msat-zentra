"use client";

import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PendingStudent } from "./types";

type Props = {
  student: PendingStudent;
  /** Opens the page-level verification dock (LrnVerifyDock). */
  onOpen: () => void;
};

/**
 * 24px primary action — icon + label; the verification itself runs in the
 * page-level dock. Enabled even without an LRN so the dock can still reject
 * the sign-up.
 */
export function LrnVerifyButton({ student, onOpen }: Props) {
  const lrn = student.lrn.trim();
  const missing = lrn.length === 0 || lrn === "—";
  const hint = missing
    ? "No LRN on record — review or reject"
    : "Verify the claimed LRN against student records";

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="h-6 shrink-0 gap-1 px-2 text-[11px] font-medium shadow-none"
            onClick={onOpen}
            aria-label={missing ? `Review ${student.name} — no LRN on record` : `Verify LRN for ${student.name}`}
          >
            <Fingerprint className="size-3.5" aria-hidden />
            Verify account
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={6}>
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
