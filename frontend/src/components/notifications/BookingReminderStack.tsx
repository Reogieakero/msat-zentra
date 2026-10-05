"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import {
  guidanceNotificationTarget,
  nurseNotificationTarget,
  teacherNotificationTarget,
} from "@/lib/notifications/label";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { ReminderStack } from "./ReminderStack";
import styles from "./booking-reminder.module.css";

export interface BookingReminder {
  id: string;
  title: string;
  message: string;
  href: string | null;
}

/* Session-driven reminder engine — the card's ONLY trigger is the live
   session list (sileo + bell stay notification-driven and untouched).
   A card drops for a scheduled session due within the advance window
   (5 minutes) or already overdue, with no action and no X on record.
   Handled keys are session-scoped (`sess:<id>`); old notification-id
   entries simply age out of the 30-day store. */
const UPCOMING_WINDOW_MS = 5 * 60 * 1000;

interface DeskSession {
  sessionId: string;
  sourceTable: "referrals" | "interventions" | "adm_profiles";
  sourceId: string;
  track: string;
  student: string;
  section: string;
  sessionType: string;
  scheduledAt: string;
  venue: string;
  status: string;
}

function sessionKey(s: DeskSession): string {
  return `sess:${s.sessionId}`;
}

function sessionDue(s: DeskSession, now: number): boolean {
  if (s?.status !== "scheduled") return false;
  const t = new Date(s.scheduledAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= now + UPCOMING_WINDOW_MS;
}

function hrefFor(
  desk: ReminderDesk,
  s: DeskSession
): string | null {
  // The nurse/guidance targets sniff "ADM" off the message to pick the ADM
  // timeline — pass the track through for routing only (never displayed).
  const routingMessage = s.track === "ADM" ? `ADM ${s.student}` : s.student;
  if (desk === "nurse") {
    return (
      nurseNotificationTarget({
        sourceTable: s.sourceTable,
        sourceId: s.sourceId,
        message: routingMessage,
      })?.href ?? null
    );
  }
  if (desk === "guidance") {
    return (
      guidanceNotificationTarget({
        sourceTable: s.sourceTable,
        sourceId: s.sourceId,
        message: routingMessage,
      })?.href ?? null
    );
  }
  if (desk === "coordinator") {
    // Profile-stage cases open the full case file; pre-profile referrals
    // highlight their consultation row on the queue (same deep-link the
    // overview forwards table uses).
    if (s.sourceTable === "adm_profiles") {
      return `/coordinator/referrals/${encodeURIComponent(s.sourceId)}`;
    }
    return `/coordinator/referrals?highlight=${encodeURIComponent(`referral:${s.sourceId}`)}`;
  }
  return (
    teacherNotificationTarget({
      sourceTable: s.sourceTable,
      sourceId: s.sourceId,
    })?.href ?? null
  );
}

const SESSION_KIND_LABELS: Record<string, string> = {
  individual: "One-on-one",
  parent_conference: "Parent conference",
  group: "Group session",
  home_visit: "Home visit",
};

/* Card message from live session facts — upcoming while in the window,
   overdue once the time passes (both with venue when set). */
function sessionMessage(s: DeskSession, now: number): string {
  const kind = SESSION_KIND_LABELS[s.sessionType] ?? s.sessionType.replace(/_/g, " ");
  const venue = s.venue?.trim() ? ` · ${s.venue.trim()}` : "";
  const d = new Date(s.scheduledAt);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const day = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDay = new Date(d);
  startOfDay.setHours(0, 0, 0, 0);
  const overdue = d.getTime() <= now;
  if (!overdue) {
    const diffDays = Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86_400_000);
    const when = diffDays === 0 ? `today at ${time}` : `${day} at ${time}`;
    return `${s.student} — upcoming ${kind} meetup, ${when}${venue}`;
  }
  return `${s.student} — overdue ${kind} meetup, ${day} at ${time}${venue} — still unattended`;
}

/* Evaluate the live session list for the desk and drop cards for due,
   unhandled sessions (nearest first, capped). Shared by mount, the
   30-second tick, tab-focus returns, and booking-mutation success. */
function evaluateSessions(desk: ReminderDesk): void {
  apiClient
    .get<DeskSession[]>("/api/my-sessions/upcoming")
    .then(({ data }) => {
      if (!Array.isArray(data)) return;
      const now = Date.now();
      const due = data
        .filter((s) => sessionDue(s, now))
        .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
      let changed = false;
      // No stack cap: every due unhandled session shows. Handled (X / View
      // case) cards never re-drop, so dismissing can't surface "new" ones.
      for (const s of due) {
        const id = sessionKey(s);
        if (reminders.some((x) => x.id === id)) continue;
        if (isHandled(id)) continue;
        reminders = [
          {
            id,
            title: "Upcoming session",
            message: sessionMessage(s, now),
            href: hrefFor(desk, s),
          },
          ...reminders,
        ];
        changed = true;
      }
      if (changed) emit();
    })
    .catch(() => undefined);
}

let reminders: BookingReminder[] = [];
const listeners = new Set<() => void>();

/* Handled reminders persist across reloads (cleared on logout with the
   rest of the zentra.* keys): a dismissed (X) or acted-on (View case) card
   never re-drops. Anything still live and unhandled re-drops on every
   login — the reminder stands until the reader deals with it. */
const HANDLED_KEY = "zentra.booking-reminders-handled";
const HANDLED_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type HandledHow = "dismissed" | "acted";

function loadHandled(): Record<string, { how: HandledHow; at: number }> {
  try {
    const raw = window.localStorage.getItem(HANDLED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { how: HandledHow; at: number }>;
    if (!parsed || typeof parsed !== "object") return {};
    const cutoff = Date.now() - HANDLED_TTL_MS;
    let pruned = false;
    for (const [id, v] of Object.entries(parsed)) {
      if (!v || typeof v.at !== "number" || v.at < cutoff) {
        delete parsed[id];
        pruned = true;
      }
    }
    if (pruned) {
      try {
        window.localStorage.setItem(HANDLED_KEY, JSON.stringify(parsed));
      } catch {
        // Storage full/blocked — memory-only from here.
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

let handled: Record<string, { how: HandledHow; at: number }> | null = null;

function handledMap(): Record<string, { how: HandledHow; at: number }> {
  if (!handled) handled = loadHandled();
  return handled;
}

function markHandled(id: string, how: HandledHow) {
  const map = handledMap();
  map[id] = { how, at: Date.now() };
  try {
    window.localStorage.setItem(HANDLED_KEY, JSON.stringify(map));
  } catch {
    // Storage full/blocked — memory-only from here.
  }
}

function isHandled(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(handledMap(), id);
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function snapshot(): BookingReminder[] {
  return reminders;
}

export type ReminderDesk = "nurse" | "guidance" | "teacher" | "coordinator";

let activeDesk: ReminderDesk | null = null;
let lastRefreshAt = 0;
const REFRESH_THROTTLE_MS = 10_000;

/** Re-run the session evaluation now (mutation success, tab focus).
 *  Throttled — one small list fetch per call. */
export function refreshBookingReminders(): void {
  if (!activeDesk) return;
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_THROTTLE_MS) return;
  lastRefreshAt = now;
  evaluateSessions(activeDesk);
}

export function dismissBookingReminder(id: string, how: HandledHow = "dismissed") {
  markHandled(id, how);
  const next = reminders.filter((r) => r.id !== id);
  if (next.length !== reminders.length) {
    reminders = next;
    emit();
  }
}

export function useBookingReminders(): BookingReminder[] {
  return React.useSyncExternalStore(subscribe, snapshot, snapshot);
}

/* Persistent top-center booking reminder rendered as a React-Bits-style
   stacked deck (spring fanning, drag or click to cycle). Stays until the
   reader dismisses (X) or acts (View case). Mounted once per desk layout
   so it survives page navigation. */
export function BookingReminderStack({ desk }: { desk: ReminderDesk }) {
  const items = useBookingReminders();
  const router = useRouter();

  React.useEffect(() => {
    activeDesk = desk;
    evaluateSessions(desk);
    // Re-evaluate every 30 seconds so a future booking drops its card the
    // moment it enters the 5-minute window while the page stays open
    // (handled/dismissed cards never re-drop; dead bookings stay silent).
    const timer = window.setInterval(() => evaluateSessions(desk), 30_000);
    // Returning to the tab re-evaluates immediately instead of waiting
    // for the next poll/minute tick (throttled inside refresh).
    const onFocus = () => refreshBookingReminders();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      if (activeDesk === desk) activeDesk = null;
    };
  }, [desk]);
  if (items.length === 0) return null;

  const byId = new Map(items.map((r) => [r.id, r] as const));

  const viewCase = (r: BookingReminder) => {
    dismissBookingReminder(r.id, "acted");
    if (r.href) router.push(r.href);
  };

  const renderCard = (id: string) => {
    const r = byId.get(id);
    if (!r) return null;
    return (
      <div
        className={`${assign.card} ${styles.drop}`}
        role="alert"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className={styles.cardRow}>
        <span className={styles.icon} aria-hidden="true">
          <CalendarClock size={20} />
        </span>
        <div className={styles.body}>
          <p className={styles.title}>{r.title}</p>
          <p className={styles.message}>{r.message}</p>
        </div>
        <div className={styles.actions}>
          {r.href ? (
            <Button
              type="button"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                viewCase(r);
              }}
            >
              View case
            </Button>
          ) : null}
          <button
            type="button"
            className={styles.dismiss}
            onClick={(e) => {
              e.stopPropagation();
              dismissBookingReminder(r.id);
            }}
            aria-label="Dismiss booking reminder"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.stack} role="region" aria-label="Booking reminders">
      <ReminderStack
        ids={items.map((r) => r.id)}
        renderCard={renderCard}
        sensitivity={180}
      />
    </div>
  );
}
