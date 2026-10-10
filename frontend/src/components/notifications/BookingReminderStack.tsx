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

export function refreshBookingReminders(force = false): void {
  if (!activeDesk) return;
  const now = Date.now();
  if (!force && now - lastRefreshAt < REFRESH_THROTTLE_MS) return;
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

export function BookingReminderStack({ desk }: { desk: ReminderDesk }) {
  const items = useBookingReminders();
  const router = useRouter();

  React.useEffect(() => {
    activeDesk = desk;
    evaluateSessions(desk);
    const timer = window.setInterval(() => evaluateSessions(desk), 30_000);
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
