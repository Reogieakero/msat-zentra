"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import {
  AttendanceHeader,
  type HeatmapNavTarget,
} from "./components/AttendanceHeader";
import { AttendanceHeatblocks } from "./components/AttendanceHeatblocks";
import { SubjectHeatblocks } from "./components/SubjectHeatblocks";
import { SectionAverages } from "./components/SectionAverages";
import { SchoolTrend } from "./components/SchoolTrend";
import { NeedsAttention } from "./components/NeedsAttention";
import styles from "./components/attendance.module.css";

type Session = "AM" | "PM";
type View = "daily" | "subject" | "averages" | "trend" | "attention";

const SESSION_KEY = "attendance-heatmap:session";

// URL tabs for the sidebar card navigation: ?tab=daily-heatblocks etc.
const TAB_PARAM = "tab";
const TAB_DAILY = "daily-heatblocks";
const TAB_SUBJECT = "subject-heatblocks";
const TAB_AVERAGES = "section-averages";
const TAB_TREND = "school-trend";
const TAB_ATTENTION = "needs-attention";

function viewFromTab(tab: string | null): View | null {
  if (tab === TAB_SUBJECT) return "subject";
  if (tab === TAB_AVERAGES) return "averages";
  if (tab === TAB_TREND) return "trend";
  if (tab === TAB_ATTENTION) return "attention";
  if (tab === TAB_DAILY) return "daily";
  return null;
}

function tabForView(view: View): string {
  if (view === "subject") return TAB_SUBJECT;
  if (view === "averages") return TAB_AVERAGES;
  if (view === "trend") return TAB_TREND;
  if (view === "attention") return TAB_ATTENTION;
  return TAB_DAILY;
}

function PageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = usePersistentState<Session>(SESSION_KEY, "AM");

  // View lives in the URL (?tab=...) so sidebar clicks are shareable and
  // survive reloads. Falls back to the last persisted view, then daily.
  const [storedView, setStoredView] = usePersistentState<View>(
    "attendance-heatmap:view",
    "daily"
  );
  const view = viewFromTab(searchParams.get(TAB_PARAM)) ?? storedView;

  // Right-sidebar cards are the only navigation: each one swaps the main
  // panel content (and the URL tab) without moving the scroll position —
  // scrolling stays entirely in the user's hands. No drill-down.
  const handleNavigate = (target: HeatmapNavTarget) => {
    setStoredView(target);
    const params = new URLSearchParams(searchParams.toString());
    params.set(TAB_PARAM, tabForView(target));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          {view === "daily" ? (
            <AttendanceHeatblocks session={session} onSessionChange={setSession} />
          ) : view === "subject" ? (
            <SubjectHeatblocks />
          ) : view === "averages" ? (
            <SectionAverages session={session} onSessionChange={setSession} />
          ) : view === "trend" ? (
            <SchoolTrend session={session} onSessionChange={setSession} />
          ) : (
            <NeedsAttention session={session} onSessionChange={setSession} />
          )}
        </div>

        <AttendanceHeader active={view} onNavigate={handleNavigate} />
      </div>
    </section>
  );
}

export default function PrincipalAttendanceHeatmapsPage() {
  return (
    <React.Suspense>
      <PageInner />
    </React.Suspense>
  );
}
