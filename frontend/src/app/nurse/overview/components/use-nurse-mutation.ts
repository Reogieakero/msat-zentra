"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useDock } from "@/components/dock/dock-store";
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

  /**
   * Runs on failure in addition to the shared error handling — e.g. to fail a
   * Dock task that the caller handed the request to. Mutation-level callbacks
   * fire even after the component unmounts (unlike `mutate` per-call options),
   * so an action may close its overlay at submit and still report here.
   */
  onErrorExtra?: (err: Error, variables: TVariables) => void;

  sourceId?: string | ((variables: TVariables) => string);

  scopes?: NurseScope | NurseScope[];

  /**
   * Skip the automatic scope invalidation on success — for actions that
   * patch every cached copy themselves, so the page never visibly refetches.
   */
  skipInvalidate?: boolean;

  /**
   * Optional optimistic patch applied to every cached query under `scopes`
   * (page keys are prefixed, e.g. ["nurse-overview", "preview", termKey])
   * before the mutation runs. Snapshots are restored on error (rollback)
   * and the keys are invalidated on success unless `skipInvalidate`.
   */
  optimisticUpdate?: (old: unknown, variables: TVariables) => unknown;

  /**
   * Report the request to the shared Dock. On by default so every nurse
   * action surfaces in the bottom-right; callers that already own a Dock
   * task (custom kind/labels) opt out with `dock: false`.
   */
  dock?: boolean;

  /** Optional completion line shown in the Dock (falls back to the title). */
  dockMessage?: (variables: TVariables, data: TData) => string | undefined;
}

export function useNurseMutation<TData = unknown, TVariables = void>(
  options: NurseMutationOptions<TData, TVariables>
) {
  const queryClient = useQueryClient();
  const dock = useDock();
  const invalidate = () => invalidateNurseQueries(queryClient, options.scopes);
  const scopeKeys = (
    !options.scopes
      ? NURSE_QUERY_KEYS
      : (Array.isArray(options.scopes) ? options.scopes : [options.scopes]).flatMap(
          (s) => NURSE_SCOPE_KEYS[s],
        )
  ).map((k) => [...k]);
  return useMutation<TData, Error, TVariables, { snapshots: [QueryKey, unknown][]; taskId: string | null }>({
    mutationFn: async (variables) => options.mutationFn(variables),
    onMutate: async (variables) => {
      const snapshots: [QueryKey, unknown][] = [];
      if (options.optimisticUpdate) {
        for (const key of scopeKeys) {
          await queryClient.cancelQueries({ queryKey: key });
          // Patch every cached query under the scope key (page keys are
          // prefixed) and snapshot each one so rollback restores the exact
          // entries — `setQueryData` on the bare scope key would instead
          // create a phantom entry nothing reads.
          const matches = queryClient.getQueryCache().findAll({ queryKey: key });
          for (const query of matches) {
            snapshots.push([query.queryKey, query.state.data]);
          }
          for (const query of matches) {
            queryClient.setQueryData(query.queryKey, (old: unknown) =>
              options.optimisticUpdate!(old, variables),
            );
          }
        }
      }
      let taskId: string | null = null;
      if (options.dock !== false) {
        try {
          taskId = dock.startTask({ kind: "generic", title: options.successTitle, description: "Nurse desk" });
        } catch {
          taskId = null;
        }
      }
      return { snapshots, taskId };
    },
    onSuccess: (data, variables, context) => {

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
      if (!options.skipInvalidate) invalidate();
      if (context?.taskId) {
        dock.completeTask(context.taskId, options.dockMessage?.(variables, data));
      }
      toast.success({
        title: options.successTitle,
        ...(options.successDescription
          ? { description: options.successDescription(variables, data) }
          : {}),
      });
      options.onSuccessExtra?.(data, variables);
    },

    onError: (err, variables, context) => {
      for (const [key, snapshot] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, snapshot);
      }
      options.onErrorExtra?.(err, variables);
      if (context?.taskId) {
        dock.failTask(context.taskId, apiErrorMessage(err, options.errorFallback));
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
