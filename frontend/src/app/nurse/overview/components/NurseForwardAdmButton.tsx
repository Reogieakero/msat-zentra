"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { forwardNurseAdmCase } from "@/services/nurse/referrals.service";
import { useNurseMutation } from "./use-nurse-mutation";

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
    sourceId: id,
    onSuccessExtra: () => onChanged(),
  });
  const sending = forwardMutation.isPending;

  return (
    <Button
      variant="default"
      size="xs"
      disabled={sending}
      onClick={() => forwardMutation.mutate()}

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
