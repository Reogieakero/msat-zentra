"use client";

import * as React from "react";
import { apiClient } from "@/lib/api/client";
import { sileo } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { useTeacherInvalidate } from "../../../components/use-teacher-invalidate";

export function useReopenReferral() {
  const invalidateTeacher = useTeacherInvalidate();
  const [isPending, setIsPending] = React.useState(false);
  const pendingRef = React.useRef(false);

  const reopen = React.useCallback(
    async (
      row: { id: string },
      opts?: { referredToRole?: string; consultReviewer?: string | null },
    ): Promise<void> => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setIsPending(true);
      try {
        const { data } = await apiClient.post<{ id: string }>(
          `/api/referrals/${row.id}/reopen`,
          {
            ...(opts?.referredToRole ? { referredToRole: opts.referredToRole } : {}),
            ...(opts?.consultReviewer ? { consultReviewer: opts.consultReviewer } : {}),
          },
        );
        if (data?.id) markSelfNotified(data.id);
        invalidateTeacher.referrals();
        sileo.success({ title: "Referral re-submitted", description: "The case is pending again." });
      } catch (err) {
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ?? "Could not re-submit this referral.";
        sileo.error({ title: "Could not re-submit referral", description: message });
      } finally {
        pendingRef.current = false;
        setIsPending(false);
      }
    },
    [invalidateTeacher],
  );

  return { reopen, isPending };
}
