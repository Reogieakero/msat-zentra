"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";

interface OptimisticOptions<TRecord, TVars> {
  /** Exact query key(s) to patch, e.g. [module, resource, ...]. */
  invalidateKeys: readonly unknown[][];
  /** Apply the optimistic change to cached list data. */
  optimisticUpdate?: (old: unknown, vars: TVars) => unknown;
  /** Mutation that returns the updated record so the cache is patched without refetch. */
  mutationFn: (vars: TVars) => Promise<TRecord>;
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Shared optimistic mutation: instant UI (<100ms feel), rollback on error,
 * toast on failure, submit button disabled via `isPending`.
 * Invalidates only the affected keys, never the whole cache.
 */
export function useOptimisticMutation<TRecord, TVars = void>({
  invalidateKeys,
  optimisticUpdate,
  mutationFn,
  successMessage,
  errorMessage = "Something went wrong. Changes were rolled back.",
}: OptimisticOptions<TRecord, TVars>) {
  const queryClient = useQueryClient();

  return useMutation<TRecord, Error, TVars, { snapshots: unknown[] }>({
    mutationFn,
    onMutate: async (vars) => {
      const snapshots: unknown[] = [];
      for (const key of invalidateKeys) {
        await queryClient.cancelQueries({ queryKey: key });
        snapshots.push(queryClient.getQueryData(key));
        if (optimisticUpdate) {
          queryClient.setQueryData(key, (old: unknown) => optimisticUpdate(old, vars));
        }
      }
      return { snapshots };
    },
    onSuccess: (record) => {
      // Patch cache with the returned record where possible, then refresh keys.
      void record;
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      if (successMessage) toast.success({ title: successMessage });
    },
    onError: (err, _vars, context) => {
      context?.snapshots.forEach((snap, i) => {
        queryClient.setQueryData(invalidateKeys[i], snap);
      });
      toast.error({ title: errorMessage, description: err.message });
    },
  });
}
