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
}

export function useNurseMutation<TData = unknown, TVariables = void>(
  options: NurseMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateNurseQueries(queryClient, options.scopes);
  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => options.mutationFn(variables),
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
