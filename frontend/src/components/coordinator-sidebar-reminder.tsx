"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import styles from "./coordinator-sidebar-reminder.module.css";

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

function sessionDue(s: DeskSession, now: number): boolean {
  if (s?.status !== "scheduled") return false;
  const t = new Date(s.scheduledAt).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= now + UPCOMING_WINDOW_MS;
}

function hrefForSession(s: DeskSession): string | null {
  const id = s.sourceTable === "adm_profiles" ? s.sourceId : `referral:${s.sourceId}`;
  return `/coordinator/referrals/${encodeURIComponent(id)}`;
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

function useLiveSidebarSessions(): { sessions: DeskSession[]; now: number } {
  const [sessions, setSessions] = React.useState<DeskSession[]>([]);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiClient
        .get<DeskSession[]>("/api/my-sessions/upcoming")
        .then(({ data }) => {
          if (cancelled || !Array.isArray(data)) return;
          const now = Date.now();
          const due = data
            .filter((s) => sessionDue(s, now))
            .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
          setSessions(due);
          setNow(now);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  return { sessions, now };
}

export function CoordinatorSidebarReminder() {
  const router = useRouter();
  const { sessions, now } = useLiveSidebarSessions();

  const current = sessions[0] ?? null;
  const extraCount = sessions.length > 1 ? sessions.length - 1 : 0;

  if (!current) return null;

  const message = sessionMessage(current, now);
  const isOverdue = /overdue/i.test(message);
  const eyebrow = isOverdue ? "Meeting overdue" : "Live parent meeting";
  const href = hrefForSession(current);

  const handleView = () => {
    if (href) router.push(href);
  };

  return (
    <div className={styles.card} role="alert" aria-live="polite">
      <div className={styles.visual} aria-hidden="true">
        <span className={styles.visualInner}>
          <span className={styles.visualIcon}>
            <CalendarClock size={12} strokeWidth={2} />
          </span>
          <span className={styles.liveDot} />
          <span>{eyebrow}</span>
        </span>
      </div>
      <div className={styles.body}>
        <p className={styles.title}>
          {isOverdue ? "A meeting needs you now." : "A meeting is starting now."}
        </p>
        <p className={styles.message}>{message}</p>
        {extraCount > 0 ? (
          <p className={styles.meta}>
            <span className={styles.metaCount}>+{extraCount}</span>
            <span>
              {extraCount === 1 ? "more meeting" : "more meetings"} waiting
            </span>
          </p>
        ) : null}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.cta} onClick={handleView}>
          View case
        </button>
      </div>
    </div>
  );
}
