"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
import type { DockTaskKind } from "@/components/dock/dock-types";
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
    ["guidance-risk-behavioral"],
    ["guidance-risk-alert-factors"],
  ],
  documents: [["guidance-session-documents"]],
  notifications: [["guidance-notifications"]],
};

export function invalidateGuidanceQueries(
  queryClient: { invalidateQueries: (filters: { queryKey: string[] }) => Promise<void> },
  scopes?: GuidanceScope | GuidanceScope[],
): Promise<void[]> {
  const keys = !scopes
    ? GUIDANCE_QUERY_KEYS
    : (Array.isArray(scopes) ? scopes : [scopes]).flatMap((s) => GUIDANCE_SCOPE_KEYS[s]);
  return Promise.all(
    keys.map((key) => queryClient.invalidateQueries({ queryKey: [...key] })),
  );
}

export function useGuidanceInvalidate(scopes?: GuidanceScope | GuidanceScope[]) {
  const queryClient = useQueryClient();
  return () => invalidateGuidanceQueries(queryClient, scopes);
}

export interface GuidanceDockOptions<TVariables> {
  kind?: DockTaskKind;
  title: string | ((variables: TVariables) => string);
  description: string | ((variables: TVariables) => string);
  /** Text the settled row shows. Falls back to `successDescription`/`successTitle`. */
  done?: string | ((variables: TVariables) => string);
  /** Failure text. Falls back to the API error message. */
  fail?: string | ((variables: TVariables) => string);
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
  /** Apply an instant optimistic cache patch. Return a rollback to run on error. */
  optimisticUpdate?: (queryClient: QueryClient, variables: TVariables) => (() => void) | void;
  /** Show this mutation as a task in the shared bottom-right Dock. */
  dock: GuidanceDockOptions<TVariables>;
}

interface GuidanceMutationContext {
  rollback?: () => void;
  dockTaskId?: string;
  dockDone?: string;
  dockFail?: string;
}

function dockText<TVariables>(
  value: string | ((variables: TVariables) => string),
  variables: TVariables
): string {
  return typeof value === "function" ? value(variables) : value;
}

export function useGuidanceMutation<TData = unknown, TVariables = void>(
  options: GuidanceMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const dock = useDock();
  const invalidate = () => invalidateGuidanceQueries(queryClient, options.scopes);
  return useMutation<TData, Error, TVariables, GuidanceMutationContext>({
    mutationFn: async (variables) => options.mutationFn(variables),
    onMutate: async (variables) => {
      // Instant UI update — runs before the network request resolves.
      await queryClient.cancelQueries();
      const rollback = options.optimisticUpdate?.(queryClient, variables);

      let dockTaskId: string | undefined;
      let dockDone: string | undefined;
      let dockFail: string | undefined;
      try {
        dockTaskId = dock.startTask({
          kind: options.dock.kind ?? "generic",
          title: dockText(options.dock.title, variables),
          description: dockText(options.dock.description, variables),
        });
        dockDone = options.dock.done
          ? dockText(options.dock.done, variables)
          : undefined;
        dockFail = options.dock.fail
          ? dockText(options.dock.fail, variables)
          : undefined;
      } catch {
        // Dock is optional feedback — never let it block the mutation.
        dockTaskId = undefined;
        dockDone = undefined;
        dockFail = undefined;
      }

      return {
        rollback: typeof rollback === "function" ? rollback : undefined,
        dockTaskId,
        dockDone,
        dockFail,
      };
    },
    onSuccess: (data, variables, context) => {
      const successTitle = options.successTitle;
      const successDescription = options.successDescription;
      // The Dock is the single success surface: settle the task with the real
      // outcome instead of popping a second toast on top of it.
      if (context?.dockTaskId) {
        const doneText =
          context.dockDone ??
          (successDescription
            ? successDescription(variables, data)
            : successTitle);
        dock.completeTask(context.dockTaskId, doneText);
      } else if (!options.silentSuccess) {
        toast.success({
          title: successTitle,
          ...(successDescription
            ? { description: successDescription(variables, data) }
            : {}),
        });
      }
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
      options.onSuccessExtra?.(data, variables);
      void invalidate().catch(() => {
        // Stale lists retry on focus; success must not be swallowed.
      });
    },

    onError: (err, _variables, context) => {
      context?.rollback?.();
      if (context?.dockTaskId) {
        dock.failTask(
          context.dockTaskId,
          context.dockFail ?? apiErrorMessage(err, options.errorFallback)
        );
      }
      if (!options.silentError) {
        toast.error({
          title: options.errorTitle ?? "Update failed",
          description: apiErrorMessage(err, options.errorFallback),
        });
      }
    },
  });
}
