"use client";

import * as React from "react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import {
  hasDeskSoundGesture,
  playDeskSound,
  type DeskSound,
} from "@/lib/notify/deskSounds";

/**
 * Login catch-up for the desk sounds.
 *
 * Live alerts ring while the shell is mounted (realtime frames + background
 * polls). Nothing rings while nobody is signed in — so this closes the gap: on
 * the first mount of a desk for a user it reads that user's **unread** desk
 * notifications and, if any of them still need attention, rings the matching
 * clip once plus one toast.
 *
 * Two local keys per desk+user (`zentra.desk.<kind>.<role>.<userId>`):
 *  - `seen` is the last time this desk was opened. Unread rows older than it
 *    were already there during the previous visit, so a plain refresh stays
 *    silent. A browser that has never opened this desk has no `seen`, and any
 *    waiting work rings — that is the "you were not signed in" case.
 *  - `rangAt` throttles the catch-up clip so reloading the desk repeatedly
 *    cannot replay it.
 */

const KEY_PREFIX = "zentra.desk";
/** A pending catch-up ring gives up if the user never touches the page. */
const PENDING_TIMEOUT_MS = 120_000;
/** At most one catch-up ring per desk within this window. */
const RING_THROTTLE_MS = 5 * 60_000;

function keyFor(kind: "seen" | "rangAt", role: string, userId: string): string {
  return `${KEY_PREFIX}.${kind}.${role}.${userId}`;
}

function readNumber(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable — the catch-up just runs once more next time */
  }
}

export function readDeskSeen(role: string, userId: string): number | null {
  return readNumber(keyFor("seen", role, userId));
}

export function markDeskSeen(role: string, userId: string, at = Date.now()): void {
  writeNumber(keyFor("seen", role, userId), at);
}

/**
 * Reserve the one catch-up ring for this desk. Returns false while another
 * catch-up (notification backlog or desk data) already rang inside the
 * throttle window, so a single login can never ring twice.
 */
export function claimCatchUpRing(role: string, userId: string): boolean {
  const ringKey = keyFor("rangAt", role, userId);
  const rangAt = readNumber(ringKey);
  if (rangAt !== null && Date.now() - rangAt < RING_THROTTLE_MS) return false;
  writeNumber(ringKey, Date.now());
  return true;
}

/**
 * Ring `kind` for work that arrived while the desk was closed. Browsers block
 * audio until the page has seen a gesture, so before the first click/keypress
 * the ring is deferred to that gesture instead of being dropped.
 */
export function ringCatchUp(kind: DeskSound): void {
  if (typeof window === "undefined") return;
  if (hasDeskSoundGesture()) {
    playDeskSound(kind);
    return;
  }
  const opts: AddEventListenerOptions = { capture: true };
  const timer = window.setTimeout(cancel, PENDING_TIMEOUT_MS);
  function cleanup() {
    window.removeEventListener("pointerdown", fire, opts);
    window.removeEventListener("keydown", fire, opts);
    window.clearTimeout(timer);
  }
  function cancel() {
    cleanup();
  }
  function fire() {
    cleanup();
    // `primeDeskSounds()`' muted unlock probe is playing/pausing on this same
    // gesture; let it settle so the one-clip-at-a-time bus is free.
    window.setTimeout(() => playDeskSound(kind), 120);
  }
  window.addEventListener("pointerdown", fire, opts);
  window.addEventListener("keydown", fire, opts);
}

export interface CatchUpRow {
  id: string;
  type: string | null;
  sourceTable: string | null;
  message: string | null;
  isRead?: boolean;
  createdAt: string;
}

/** "you did X" rows are the actor's own confirmations, never desk arrivals. */
function isOwnEcho(row: CatchUpRow): boolean {
  return /_self$/.test(row.type ?? "") || /^you\b/i.test(row.message ?? "");
}

export interface DeskCatchUpOptions {
  /** Desk identity for the local keys — one pair per role. */
  role: string;
  userId: string | null;
  /** Clip a waiting row would have rung live, or null to ignore it. */
  clipFor: (row: CatchUpRow) => DeskSound | null;
  enabled?: boolean;
  title?: string;
}

export function useDeskCatchUp({
  role,
  userId,
  clipFor,
  enabled = true,
  title = "Updates while you were away",
}: DeskCatchUpOptions): void {
  const key = `${role}:${userId ?? ""}`;
  const ranForRef = React.useRef<string | null>(null);

  // Refresh the "last opened" stamp while the desk is open, so the next login
  // only reports what happened *after* this visit.
  React.useEffect(() => {
    if (!userId) return;
    const write = () => markDeskSeen(role, userId);
    window.addEventListener("pagehide", write);
    return () => {
      window.removeEventListener("pagehide", write);
      write();
    };
  }, [role, userId]);

  React.useEffect(() => {
    if (!enabled || !userId) return;
    if (ranForRef.current === key) return;
    ranForRef.current = key;

    const seenAt = readDeskSeen(role, userId);
    // Stamp the visit immediately: even if the catch-up request fails, the
    // next login must not re-report the same backlog.
    markDeskSeen(role, userId);

    let cancelled = false;
    void (async () => {
      try {
        // Unread rows are exactly "work still waiting on this desk", which is
        // what a user who was signed out has not seen. The server flag beats a
        // client watermark: it survives a fresh browser, another device, and a
        // login that happened before this code ever ran.
        const { data } = await apiClient.get<CatchUpRow[]>("/api/notifications/", {
          params: { take: 50, unreadOnly: 1 },
        });
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        const waiting = data
          .filter((row) => !isOwnEcho(row))
          .filter((row) => {
            // A desk that has been opened before only reports what landed
            // after that visit, so an ordinary refresh stays silent. First
            // visit (no stamp) reports everything still unread.
            if (seenAt === null) return true;
            const created = Date.parse(row.createdAt);
            return Number.isFinite(created) && created > seenAt;
          });
        if (waiting.length === 0) return;
        const clip = waiting
          .map(clipFor)
          .find((kind): kind is DeskSound => kind !== null);
        if (!clip) return;

        if (!claimCatchUpRing(role, userId)) return;

        toast.info({
          title,
          description: `${waiting.length} update${waiting.length === 1 ? "" : "s"} waiting on this desk.`,
        });
        ringCatchUp(clip);
      } catch {
        /* offline — the unread badge still shows the work */
      }
    })();

    return () => {
      cancelled = true;
    };
    // `clipFor` is intentionally not a dependency: `ranForRef` already pins the
    // run to one per desk+user, and callers pass an inline classifier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, role, userId, enabled]);
}
