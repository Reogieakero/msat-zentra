"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import {
  guidanceNotificationTitle,
  prettifyNotificationType,
} from "@/lib/notifications/label";

const GUIDANCE_KEYS = [
  ["guidance-notifications"],
  ["guidance-referrals"],
  ["guidance-interventions"],
  ["guidance-overview"],
  // ["guidance-alerts"] prefix covers the nested alerts queries
  // (["guidance-alerts", "referrals"] / ["guidance-alerts", "interventions"]).
  ["guidance-alerts"],
  ["guidance-adm"],
  ["guidance-anecdotal"],
  ["guidance-risk"],
  ["guidance-risk-levels"],
  ["guidance-risk-heatmap"],
  ["guidance-risk-behavioral"],
  ["guidance-referrals-highlight"],
  ["adm-consultation-sessions"],
] as const;

interface GuidanceInboxRow {
  id: string;
  userId: string;
  type: string;
  sourceTable: string | null;
  sourceId: string | null;
  message: string;
  createdAt: string;
}

// Inbox poll cadence — the working transport alongside the realtime
// wake-up below (the anon Supabase client never receives row-scoped events
// for backend-signed sessions). Cheap indexed query; rows already seen are
// skipped. Kept short so referred cases toast within seconds.
const INBOX_POLL_MS = 5_000;
const MAX_TOASTS_PER_SYNC = 3;

/** Self-confirmation receipts the counselor wrote themselves — these land
 *  in the bell inbox but must never pop a second sileo (the mutation
 *  already showed a success toast). Matched by message since every referral
 *  fanout shares type `referral_status_change`. Strings mirror
 *  referrals.routes.ts + guidance.routes.ts counselor self fanouts. */
function isSelfReceipt(n: GuidanceInboxRow): boolean {
  return /^you (accepted|booked|completed|rescheduled|cancelled|marked|requested|set|started|closed|moved|endorsed|forwarded|did not endorse|escalated|reassigned|sent|dismissed|opened)\b/i.test(
    n.message ?? "",
  );
}

function toastTitleFor(n: GuidanceInboxRow): string {
  // Shared with the bell inbox titles — one mapper so sileo and inbox name
  // the event identically. Falls back to "New notification" (never the raw
  // type) when nothing matches. Self receipts resolve here too as fallback
  // safety (they are filtered before toasting, never shown twice).
  if (isSelfReceipt(n)) {
    const msg = n.message ?? "";
    if (/you accepted a guidance referral/i.test(msg)) return "Referral accepted";
    if (/you booked a guidance session/i.test(msg)) return "Session booked";
    if (/you completed a guidance session/i.test(msg)) return "Session completed";
    if (/you completed a session and set a follow-up/i.test(msg)) return "Follow-up set";
    if (/you rescheduled a guidance session/i.test(msg)) return "Session rescheduled";
    if (/you cancelled a guidance session/i.test(msg)) return "Session cancelled";
    if (/marked .* resolved/i.test(msg)) return "Referral resolved";
    if (/you requested more info/i.test(msg)) return "Info requested";
    if (/you set a follow-up/i.test(msg)) return "Follow-up set";
    if (/you started handling/i.test(msg)) return "Handling started";
    if (/you closed a guidance referral/i.test(msg)) return "Referral closed";
    if (/you dismissed a referral/i.test(msg)) return "Referral dismissed";
    if (/you moved .* pending/i.test(msg)) return "Moved to pending";
    if (/you endorsed an ADM consultation/i.test(msg)) return "ADM endorsed";
    if (/you forwarded an ADM referral/i.test(msg)) return "Sent to coordinator";
    if (/you did not endorse/i.test(msg)) return "ADM referral closed";
    if (/you escalated a referral/i.test(msg)) return "Referral escalated";
    if (/you reassigned a referral/i.test(msg)) return "Referral reassigned";
    if (/you sent a referral/i.test(msg)) return "Referral sent";
    if (/you opened a .* follow-up/i.test(msg)) return "Follow-up opened";
    if (/you booked an intervention session/i.test(msg)) return "Intervention session booked";
    if (/you completed an intervention session/i.test(msg)) return "Intervention session completed";
    if (/you rescheduled an intervention session/i.test(msg)) return "Intervention session rescheduled";
    if (/you cancelled an intervention session/i.test(msg)) return "Intervention session cancelled";
    return "Update saved";
  }
  const title = guidanceNotificationTitle(n);
  if (title === "Guidance referral update") return "New guidance referral";
  if (title === prettifyNotificationType(n.type)) return "New notification";
  return title;
}

/** Current user id from the stored access JWT (backend signs `sub`). */
function currentUserId(): string | null {
  try {
    const token = window.localStorage.getItem("zentra.access");
    if (!token) return null;
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Guidance desk realtime sync — one shared Supabase channel per mount.
 * Listens for postgres_changes on referral/intervention/session/ADM tables
 * and invalidates only the affected Guidance query prefixes, plus an
 * auth-gated inbox sync so a newly referred case pops a sileo toast the
 * moment it lands (e.g. a teacher refers a student to guidance) —
 * Notification row payloads arrive empty over realtime (anon key holds no
 * grant by design), so the INSERT event is only a wake-up call and the
 * recipient-safe REST fetch resolves what is actually new. No PHI ever
 * travels over the realtime socket.
 */
export function useGuidanceRealtime(enabled = true) {
  const queryClient = useQueryClient();
  const lastInvalidated = React.useRef(0);
  const seenIds = React.useRef<Set<string>>(new Set());
  const seeded = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) return;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const userId = currentUserId();
    if (!userId) return;
    let channel: { unsubscribe: () => void } | null = null;
    let cancelled = false;

    function invalidate() {
      // Throttle bursts (e.g. multi-row writes) to one invalidate per 2s.
      const now = Date.now();
      if (now - lastInvalidated.current < 2000) return;
      lastInvalidated.current = now;
      for (const key of GUIDANCE_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    }

    // Auth-gated inbox sync — the recipient-safe realtime path. Writes the
    // fetched inbox straight into the bell query (badge count updates
    // without a second refetch) and toasts only rows never seen before
    // (capped per sync); first run only seeds.
    async function syncInbox() {
      if (cancelled || document.hidden) return;
      try {
        const { data } = await apiClient.get<GuidanceInboxRow[]>("/api/notifications/");
        if (cancelled || !Array.isArray(data)) return;
        queryClient.setQueryData(["guidance-notifications"], data);
        const mine = data.filter((n) => n.userId === userId);
        if (!seeded.current) {
          for (const n of mine) seenIds.current.add(n.id);
          seeded.current = true;
          return;
        }
        const fresh = mine.filter((n) => !seenIds.current.has(n.id));
        for (const n of mine) seenIds.current.add(n.id);
        if (fresh.length === 0) return;
        // Own receipts already showed a success toast at mutation time —
        // bell inbox keeps the row (badge still updates via setQueryData),
        // but no second sileo.
        const toToast = fresh.filter((n) => !isSelfReceipt(n));
        // Oldest first so the newest toast stays on top.
        const ordered = [...toToast].reverse().slice(0, MAX_TOASTS_PER_SYNC);
        for (const n of ordered) {
          toast.info({ title: toastTitleFor(n), description: n.message });
        }
        void invalidate();
      } catch {
        // Offline / unauthorized — the next tick covers it.
      }
    }

    try {
      const supabase = createClient();
      const ch = supabase
        .channel("guidance-desk")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Referral" },
          () => void invalidate()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Intervention" },
          () => void invalidate()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "CounselingSession" },
          () => void invalidate()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "AdmLearnerProfile" },
          () => void invalidate()
        )
        // UNFILTERED by design: Notification row payloads arrive empty (the
        // anon key deliberately holds no grant), so the INSERT event is a
        // wake-up call; syncInbox resolves recipients via the auth-gated API.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "Notification" },
          () => void syncInbox()
        )
        .subscribe((status) => {
          // Reconcile on (re)subscribe — missed events backfill from the DB.
          if (status === "SUBSCRIBED") void syncInbox();
        });
      if (!cancelled) channel = ch as unknown as { unsubscribe: () => void };
    } catch {
      // Realtime unavailable — the poll safety net below still delivers.
    }

    // Safety net: anything realtime missed. First run only seeds the seen
    // set (no toast storm for old inbox rows).
    const timer = window.setInterval(() => void syncInbox(), INBOX_POLL_MS);
    const seedTimer = window.setTimeout(() => void syncInbox(), 1_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(seedTimer);
      try {
        channel?.unsubscribe();
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [enabled, queryClient]);
}
