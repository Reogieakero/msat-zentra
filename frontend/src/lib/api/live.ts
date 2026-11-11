"use client";

import {
  useQueries,
  useQuery,
  type QueriesResults,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";

/**
 * Live teacher desks (Classes, Grading, Lock grades, Attendance).
 *
 * These pages show work that other people change (registrar edits a
 * timetable, a co-teacher saves scores, the adviser approves finals), so they
 * refresh themselves while the tab is visible instead of waiting for the user
 * to reload. The realtime notification channel still invalidates instantly
 * when a matching notification arrives — this poll is the safety net for
 * changes that emit no notification.
 *
 * `refetchIntervalInBackground` stays false so a hidden tab stops polling,
 * and `refetchOnWindowFocus` overrides the app default (off) so coming back to
 * the tab re-reads immediately.
 */
export const LIVE_REFETCH_MS = 20_000;

export const liveQueryOptions = {
  refetchInterval: LIVE_REFETCH_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
} as const;

/**
 * `useQuery` with the live defaults baked in. Teacher/adviser desks import
 * this instead of the TanStack hook so every panel polls while the tab is
 * visible — no page needs to remember to opt in.
 *
 * Spread order is `options` first: the live settings always win, otherwise a
 * page-local `refetchOnWindowFocus: false` or a shorter `staleTime` would
 * silently bring the manual-refresh behaviour back.
 */
/**
 * Guidance desk boards (alerts + interventions) must move even while the
 * counselor is on another page, another tab, or another site — new at-risk
 * learners and referrals land without anyone touching the desk. Unlike the
 * teacher desks these keep polling while the tab is hidden, because the alert
 * sound and the tab-title badge are driven by the same refresh.
 *
 * The realtime channel is still the fast path (it invalidates in well under a
 * second); this poll only has to cover the case where the socket is down or an
 * event that emits no notification reached the database.
 */
export const GUIDANCE_REFETCH_MS = 15_000;

export const guidanceLiveQueryOptions = {
  refetchInterval: GUIDANCE_REFETCH_MS,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: true,
  // Shorter than the poll window so a focus/return always re-reads.
  staleTime: 5_000,
} as const;

export function useLiveQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> {
  return useQuery<TQueryFnData, TError, TData, TQueryKey>({
    ...options,
    ...liveQueryOptions,
  });
}

/**
 * `useQueries` (the multi-query form) with the same live defaults applied to
 * every entry — used by rails and search panels that fan out per class.
 */
export function useLiveQueries<
  T extends Array<any>,
  TCombinedResult = QueriesResults<T>,
>(
  options: Parameters<typeof useQueries<T, TCombinedResult>>[0],
): TCombinedResult {
  type Options = Parameters<typeof useQueries<T, TCombinedResult>>[0];
  const queries = (options.queries as unknown as readonly Record<string, unknown>[]).map(
    (query) => ({ ...query, ...liveQueryOptions }),
  );
  return useQueries<T, TCombinedResult>({ ...options, queries } as Options);
}
