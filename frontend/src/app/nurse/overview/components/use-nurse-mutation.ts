"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/nurseChannel";
import { apiErrorMessage } from "@/lib/api/errors";

export const NURSE_QUERY_KEYS = [
  ["nurse-alerts"],
  ["nurse-overview"],
  ["nurse-risk"],
  ["nurse-risk-levels"],
  ["nurse-risk-factors"],
  ["nurse-notifications"],
] as const;

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

  silentError?: boolean;
  onSuccessExtra?: (data: TData, variables: TVariables) => void;

  sourceId?: string | ((variables: TVariables) => string);

  scopes?: NurseScope | NurseScope[];

  /**
   * Optional optimistic patch applied to every cached query under `scopes`
   * before the mutation runs. Snapshots are restored on error (rollback)
   * and the keys are invalidated on success.
   */
  optimisticUpdate?: (old: unknown, variables: TVariables) => unknown;
}

export function useNurseMutation<TData = unknown, TVariables = void>(
  options: NurseMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateNurseQueries(queryClient, options.scopes);
  const scopeKeys = (
    !options.scopes
      ? NURSE_QUERY_KEYS
      : (Array.isArray(options.scopes) ? options.scopes : [options.scopes]).flatMap(
          (s) => NURSE_SCOPE_KEYS[s],
        )
  ).map((k) => [...k]);
  return useMutation<TData, Error, TVariables, { snapshots: [readonly string[], unknown][] }>({
    mutationFn: async (variables) => options.mutationFn(variables),
    onMutate: async (variables) => {
      if (!options.optimisticUpdate) return { snapshots: [] };
      const snapshots: [readonly string[], unknown][] = [];
      for (const key of scopeKeys) {
        await queryClient.cancelQueries({ queryKey: key });
        snapshots.push([key, queryClient.getQueryData(key)]);
        queryClient.setQueryData(key, (old: unknown) =>
          options.optimisticUpdate!(old, variables),
        );
      }
      return { snapshots };
    },
    onSuccess: (data, variables) => {

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

    onError: (err, _variables, context) => {
      for (const [key, snapshot] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, snapshot);
      }
      if (!options.silentError) {
        toast.error({
          title: "Update failed",
          description: `${apiErrorMessage(err, options.errorFallback)} Changes were rolled back.`,
        });
      }
    },
  });
}
