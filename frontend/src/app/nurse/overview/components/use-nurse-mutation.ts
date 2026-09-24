"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { markNurseLocalMutation } from "@/lib/realtime/nurseRealtimeMeta";
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
  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => options.mutationFn(variables),
    onSuccess: (data, variables) => {
      // Mark the write so inbound realtime echoes within a few seconds are
      // treated as our own change (no duplicate toast for the initiator).
      markNurseLocalMutation();
      for (const key of NURSE_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
      toast.success({
        title: options.successTitle,
        ...(options.successDescription
          ? { description: options.successDescription(variables, data) }
          : {}),
      });
      options.onSuccessExtra?.(data, variables);
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
