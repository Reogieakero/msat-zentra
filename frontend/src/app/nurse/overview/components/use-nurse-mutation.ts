"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/nurseChannel";
import { apiErrorMessage } from "@/lib/api/errors";

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

/**
 * Scoped invalidation: a mutation (or realtime event) only refetches the
 * queries it can actually change. Previously every nurse write and every
 * realtime event invalidated all six prefixes — one session booking
 * refetched overview + alerts + referrals + risk + notifications. The
 * default (no scope) preserves the old all-keys behavior so existing call
 * sites stay correct; pass scopes to narrow.
 */
export type NurseScope = "alerts" | "overview" | "risk" | "notifications";

const NURSE_SCOPE_KEYS: Record<NurseScope, readonly (readonly string[])[]> = {
  alerts: [["nurse-alerts"]],
  overview: [["nurse-overview"]],
  risk: [["nurse-risk"], ["nurse-risk-levels"], ["nurse-risk-factors"]],
  notifications: [["nurse-notifications"]],
};

export function invalidateNurseQueries(
  queryClient: { invalidateQueries: (filters: { queryKey: string[] }) => void },
  scopes?: NurseScope | NurseScope[],
) {
  const keys = !scopes
    ? NURSE_QUERY_KEYS
    : (Array.isArray(scopes) ? scopes : [scopes]).flatMap((s) => NURSE_SCOPE_KEYS[s]);
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: [...key] });
  }
}

export function useNurseInvalidate(scopes?: NurseScope | NurseScope[]) {
  const queryClient = useQueryClient();
  return () => invalidateNurseQueries(queryClient, scopes);
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
  /** Narrow the post-success refetch (default: all nurse keys, the previous
      behavior). Most case writes only move queue/overview/risk state. */
  scopes?: NurseScope | NurseScope[];
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
  const invalidate = () => invalidateNurseQueries(queryClient, options.scopes);
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
    // confirms — only the success refetch above moves/removes them. No
    // onSettled blanket refetch: it doubled every mutation's network cost
    // (success invalidated, then settled invalidated again) and refetched
    // on error when nothing changed.
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
