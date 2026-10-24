"use client";

import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingStudent } from "./types";

type Props = {
  student: PendingStudent;
  /** Opens the page-level verification dock (LrnVerifyDock). */
  onOpen: () => void;
};

/** 24px icon-only trigger — the verification itself runs in the dock.
 *  Enabled even without an LRN so the dock can still reject the sign-up. */
export function LrnVerifyButton({ student, onOpen }: Props) {
  const lrn = student.lrn.trim();
  const missing = lrn.length === 0 || lrn === "—";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6 shrink-0"
      onClick={onOpen}
      aria-label={missing ? `Review ${student.name} — no LRN on record` : `Verify LRN for ${student.name}`}
      title={missing ? "No LRN on record — review or reject" : "Verify LRN"}
    >
      <Fingerprint className="size-3.5" aria-hidden />
    </Button>
  );
}
