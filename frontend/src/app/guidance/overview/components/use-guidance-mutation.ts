"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { apiErrorMessage } from "../../referrals/components/guidance-referrals-data";

/**
 * Shared guidance-desk mutation helper (mirrors the nurse desk).
 *
 * Every guidance mutation follows the same production lifecycle:
 *   idle → pending (button disabled + spinner) → success (toast + targeted
 *   invalidation) OR error (inline message + error toast) → settled.
 *
 * Centralizing the invalidation keys here prevents drift: every guidance
 * mutation refreshes exactly the guidance queries and nothing else —
 * no whole-app refetch, no stale desk after a write.
 */
export const GUIDANCE_QUERY_KEYS = [
  ["guidance-referrals"],
  ["guidance-referrals-highlight"],
  ["guidance-interventions"],
  ["guidance-overview"],
  // Prefix — covers ["guidance-alerts", "referrals"|"interventions"].
  ["guidance-alerts"],
  ["guidance-adm"],
  ["guidance-anecdotal"],
  ["guidance-risk"],
  ["guidance-risk-levels"],
  ["guidance-risk-heatmap"],
  ["guidance-risk-behavioral"],
  ["adm-consultation-sessions"],
] as const;

export function useGuidanceInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of GUIDANCE_QUERY_KEYS) {
      void queryClient.invalidateQueries({ queryKey: [...key] });
    }
  };
}

interface GuidanceMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successTitle: string;
  successDescription?: (variables: TVariables, data: TData) => string;
  errorTitle?: string;
  errorFallback: string;
  /** When true, suppress the error toast (caller shows inline error only). */
  silentError?: boolean;
  onSuccessExtra?: (data: TData, variables: TVariables) => void;
}

/**
 * useMutation pre-wired for the guidance desk: success toast only after the
 * server confirms, error toast (sanitized, never raw SQL/Prisma) on failure,
 * and targeted guidance-query invalidation. The caller still owns inline error
 * display via `mutation.error` + `apiErrorMessage`.
 */
export function useGuidanceMutation<TData = unknown, TVariables = void>(
  options: GuidanceMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => options.mutationFn(variables),
    onSuccess: (data, variables) => {
      for (const key of GUIDANCE_QUERY_KEYS) {
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
          title: options.errorTitle ?? "Update failed",
          description: apiErrorMessage(err, options.errorFallback),
        });
      }
    },
  });
}
