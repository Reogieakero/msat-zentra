"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/nurseChannel";
import { apiErrorMessage } from "./nurse-overview-data";

/**
 * Shared nurse-desk mutation helper.
 *
 * Every nurse mutation follows the same production lifecycle:
 *   idle → pending (button disabled + spinner) → success (toast + targeted
 *   invalidation) OR error (inline message + error toast) → settled.
 *
 * Centralizing the invalidation keys here prevents drift: every nurse
 * mutation refreshes exactly the four nurse queries and nothing else —
 * no whole-app refetch, no stale desk after a write.
 */
export const NURSE_QUERY_KEYS = [
  ["nurse-alerts"],
  ["nurse-overview"],
  ["nurse-risk"],
  ["nurse-risk-levels"],
  ["nurse-risk-factors"],
  ["nurse-notifications"],
] as const;

export function useNurseInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of NURSE_QUERY_KEYS) {
      void queryClient.invalidateQueries({ queryKey: [...key] });
    }
  };
}

interface NurseMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successTitle: string;
  successDescription?: (variables: TVariables, data: TData) => string;
  errorFallback: string;
  /** When true, suppress the error toast (caller shows inline error only). */
  silentError?: boolean;
  onSuccessExtra?: (data: TData, variables: TVariables) => void;
  /** Referral id this write acts on — confirmed writes suppress their own
      realtime echo toast for 30s (bell row still lands). Falls back to
      `data.id` when the mutation resolves one. */
  sourceId?: string | ((variables: TVariables) => string);
}

/**
 * useMutation pre-wired for the nurse desk: success toast only after the
 * server confirms, error toast (sanitized, never raw SQL/Prisma) on failure,
 * and targeted nurse-query invalidation. The caller still owns inline error
 * display via `mutation.error` + `apiErrorMessage`.
 */
export function useNurseMutation<TData = unknown, TVariables = void>(
  options: NurseMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    for (const key of NURSE_QUERY_KEYS) {
      void queryClient.invalidateQueries({ queryKey: [...key] });
    }
  };
  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => options.mutationFn(variables),
    onSuccess: (data, variables) => {
      // Per-sourceId self-suppression: the confirmed id skips its realtime
      // echo toast for 30s (bell row still lands, lists still invalidate).
      const fromData =
        typeof data === "string"
          ? data
          : (data as { id?: unknown } | null)?.id;
      const fromOption =
        typeof options.sourceId === "function"
          ? options.sourceId(variables)
          : options.sourceId;
      const sourceId =
        typeof fromOption === "string" && fromOption
          ? fromOption
          : typeof fromData === "string"
            ? fromData
            : null;
      if (sourceId) markSelfNotified(sourceId);
      invalidate();
      toast.success({
        title: options.successTitle,
        ...(options.successDescription
          ? { description: options.successDescription(variables, data) }
          : {}),
      });
      options.onSuccessExtra?.(data, variables);
    },
    // Pessimistic: rows stay put with their spinner until the server
    // confirms — only this settled refetch moves/removes them.
    onSettled: () => {
      invalidate();
    },
    onError: (err) => {
      if (!options.silentError) {
        toast.error({
          title: "Update failed",
          description: apiErrorMessage(err, options.errorFallback),
        });
      }
    },
  });
}
