"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { forwardNurseAdmCase } from "./nurse-overview-data";
import { useNurseMutation } from "./use-nurse-mutation";

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
  const forwardMutation = useNurseMutation({
    mutationFn: () => forwardNurseAdmCase(id),
    successTitle: "Case forwarded",
    successDescription: () =>
      `${student}'s case moves to the ADM coordinator for the parent meeting.`,
    errorFallback: "Could not forward this case.",
    onSuccessExtra: () => onChanged(),
  });
  const sending = forwardMutation.isPending;

  return (
    <Button
      variant="default"
      size="xs"
      disabled={sending}
      onClick={() => forwardMutation.mutate()}
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
