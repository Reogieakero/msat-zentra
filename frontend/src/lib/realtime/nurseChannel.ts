"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const NURSE_KEYS = [
  ["nurse-alerts"],
  ["nurse-overview"],
  ["nurse-risk"],
  ["nurse-risk-levels"],
] as const;

/**
 * Nurse desk realtime sync — one shared Supabase channel per mount.
 * Listens for postgres_changes on referral/session/attachment/notification
 * tables and invalidates only the affected nurse query prefixes. No polling,
 * no whole-app refetch, no toasts from realtime (mutations already toast —
 * this only refreshes data). Silently no-ops when Supabase env is missing
 * or Realtime is unreachable (staleTime + mutation invalidation remain).
 */
export function useNurseRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidated = React.useRef(0);

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    try {
      const supabase = createClient();
      const ch = supabase
        .channel("nurse-desk")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Referral" },
          () => void invalidate()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "CounselingSession" },
          () => void invalidate()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "ClinicSessionAttachment" },
          () => void invalidate()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Notification" },
          () => void invalidate()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmLearnerProfile" },
          () => void invalidate()
        )
        .subscribe();
      if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };
    } catch {
      // Realtime unavailable — freshness falls back to staleTime + invalidation.
    }

    function invalidate() {
      // Throttle bursts (e.g. multi-row writes) to one invalidate per 2s.
      const now = Date.now();
      if (now - lastInvalidated.current < 2000) return;
      lastInvalidated.current = now;
      for (const key of NURSE_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

    return () => {
      cancelled = true;
      try {
        channel?.unsubscribe();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [enabled, queryClient]);
}
