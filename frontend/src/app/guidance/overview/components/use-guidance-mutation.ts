"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { markSelfNotified } from "@/lib/realtime/guidanceChannel";
import { apiErrorMessage } from "@/lib/api/errors";

export const GUIDANCE_QUERY_KEYS = [
  ["guidance-referrals"],
  ["guidance-referrals-highlight"],
  ["guidance-interventions"],
  ["guidance-overview"],

  ["guidance-alerts"],
  ["guidance-adm"],
  ["guidance-adm-report"],
  ["guidance-anecdotal"],
  ["guidance-risk"],
  ["guidance-risk-levels"],
  ["guidance-risk-heatmap"],
  ["guidance-risk-behavioral"],
  ["guidance-risk-alert-factors"],
  ["guidance-session-documents"],
  ["guidance-notifications"],
  ["adm-consultation-sessions"],
] as const;

export type GuidanceScope =
  | "referrals"
  | "interventions"
  | "overview"
  | "alerts"
  | "adm"
  | "anecdotal"
  | "risk"
  | "documents"
  | "notifications";

const GUIDANCE_SCOPE_KEYS: Record<GuidanceScope, readonly (readonly string[])[]> = {
  referrals: [["guidance-referrals"], ["guidance-referrals-highlight"], ["adm-consultation-sessions"]],
  interventions: [["guidance-interventions"]],
  overview: [["guidance-overview"]],
  alerts: [["guidance-alerts"]],
  adm: [["guidance-adm"], ["guidance-adm-report"]],
  anecdotal: [["guidance-anecdotal"], ["guidance-risk-behavioral"]],
  risk: [
    ["guidance-risk"],
    ["guidance-risk-levels"],
    ["guidance-risk-heatmap"],
    ["guidance-risk-alert-factors"],
  ],
  documents: [["guidance-session-documents"]],
  notifications: [["guidance-notifications"]],
};

export function invalidateGuidanceQueries(
  queryClient: { invalidateQueries: (filters: { queryKey: string[] }) => void },
  scopes?: GuidanceScope | GuidanceScope[],
) {
  const keys = !scopes
    ? GUIDANCE_QUERY_KEYS
    : (Array.isArray(scopes) ? scopes : [scopes]).flatMap((s) => GUIDANCE_SCOPE_KEYS[s]);
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: [...key] });
  }
}

export function useGuidanceInvalidate(scopes?: GuidanceScope | GuidanceScope[]) {
  const queryClient = useQueryClient();
  return () => invalidateGuidanceQueries(queryClient, scopes);
}

interface GuidanceMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successTitle: string;
  successDescription?: (variables: TVariables, data: TData) => string;
  errorTitle?: string;
  errorFallback: string;

  silentError?: boolean;

  silentSuccess?: boolean;
  onSuccessExtra?: (data: TData, variables: TVariables) => void;

  sourceId?: string | ((variables: TVariables) => string);

  scopes?: GuidanceScope | GuidanceScope[];
}

export function useGuidanceMutation<TData = unknown, TVariables = void>(
  options: GuidanceMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const invalidate = () => invalidateGuidanceQueries(queryClient, options.scopes);
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
      if (!options.silentSuccess) {
        toast.success({
          title: options.successTitle,
          ...(options.successDescription
            ? { description: options.successDescription(variables, data) }
            : {}),
        });
      }
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
