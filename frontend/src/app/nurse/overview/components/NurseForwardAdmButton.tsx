"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  apiErrorMessage,
  forwardNurseAdmCase,
} from "./nurse-overview-data";

/**
 * Explicit forward for ADM cases whose referral form is completed. The case
 * reaches the ADM coordinator only when the nurse clicks this — saving the
 * form alone never moves it.
 */
export function NurseForwardAdmButton({
  id,
  student,
  onChanged,
}: {
  id: string;
  student: string;
  onChanged: () => void;
}) {
  const [sending, setSending] = React.useState(false);

  async function onForward() {
    setSending(true);
    try {
      await forwardNurseAdmCase(id);
      toast.success({
        title: "Case forwarded",
        description: `${student}'s case moves to the ADM coordinator for the parent meeting.`,
      });
      onChanged();
    } catch (err) {
      toast.error({
        title: "Forward failed",
        description: apiErrorMessage(err, "Could not forward this case."),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Button
      variant="default"
      size="xs"
      disabled={sending}
      onClick={() => void onForward()}
      /* Fixed min-width + inline spinner slot so the "Forwarding…"
         swap doesn't widen the Actions cell and shift the row. */
      style={{ minWidth: "9.5rem" }}
    >
      {sending ? (
        <>
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          {"Forwarding…"}
        </>
      ) : (
        "Endorse & forward"
      )}
    </Button>
  );
}
