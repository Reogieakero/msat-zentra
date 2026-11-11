"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ShieldAlert, User } from "lucide-react";
import { useSession } from "@/lib/auth/useSession";
import { TeacherOverviewKanban } from "./components/teacher-overview-kanban";
import { TeacherOverviewCharts } from "./components/teacher-overview-charts";
import { TeacherOverviewSkeleton } from "./components/teacher-overview-skeleton";
import {
  fetchTeacherOverviewGradebook,
  teacherOverviewGradebookKey,
  useTeacherOverview,
} from "@/services/teacher/overview.service";
import { useTerm } from "@/lib/term/TermContext";
import { PageEmptyCallout } from "@/components/shared/page-empty-callout";
import styles from "./components/teacher-overview.module.css";

/** Right-rail width is user-resizable between these bounds (px). */

/** Right-rail width is user-resizable between these bounds (px). */
const RAIL_STORAGE_KEY = "teacher-overview-rail";
const RAIL_DEFAULT_WIDTH = 320;
const RAIL_MIN_WIDTH = 264;
const RAIL_MAX_WIDTH = 480;

interface RailPrefs {
  collapsed: boolean;
  width: number;
}

function clampRailWidth(width: number): number {
  return Math.min(RAIL_MAX_WIDTH, Math.max(RAIL_MIN_WIDTH, Math.round(width)));
}

function readRailPrefs(): RailPrefs {
  try {
    const raw = window.localStorage.getItem(RAIL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RailPrefs>;
      return {
        collapsed: parsed.collapsed === true,
        width: clampRailWidth(Number(parsed.width) || RAIL_DEFAULT_WIDTH),
      };
    }
  } catch {
    // ignore corrupt/blocked storage
  }
  return { collapsed: false, width: RAIL_DEFAULT_WIDTH };
}

export default function TeacherOverviewPage() {

  const { data, isPending, isError } = useTeacherOverview();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const queryClient = useQueryClient();
  const session = useSession();
  const prefetchTeacherId = session?.sub ?? null;
  React.useEffect(() => {
    if (!prefetchTeacherId) return;
    const run = () => {
      void queryClient.prefetchQuery({
        queryKey: teacherOverviewGradebookKey(prefetchTeacherId, termKey),
        queryFn: fetchTeacherOverviewGradebook,
        staleTime: 30_000,
      });
    };
    if (typeof window !== "undefined") {
      const idleWindow = window as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof idleWindow.requestIdleCallback === "function") {
        const id = idleWindow.requestIdleCallback(run);
        return () => idleWindow.cancelIdleCallback?.(id);
      }
    }
  }, [queryClient, prefetchTeacherId, termKey]);

  // Right rail: horizontal collapse to an icon strip + drag-resizable width.
  // Preferences load after mount so prerender/hydration stay deterministic.
  const [rail, setRail] = React.useState<RailPrefs>({
    collapsed: false,
    width: RAIL_DEFAULT_WIDTH,
  });
  const railDrag = React.useRef<{ startX: number; startWidth: number } | null>(null);
  const [railResizing, setRailResizing] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of a local UI preference
    setRail(readRailPrefs());
  }, []);

  const persistRail = React.useCallback((next: RailPrefs) => {
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota/storage errors
    }
  }, []);

  const updateRail = React.useCallback(
    (updater: (prev: RailPrefs) => RailPrefs) => {
      setRail((prev) => {
        const next = updater(prev);
        persistRail(next);
        return next;
      });
    },
    [persistRail],
  );

  const toggleRail = React.useCallback(() => {
    updateRail((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, [updateRail]);

  const onRailResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rail.collapsed) return;
    railDrag.current = { startX: e.clientX, startWidth: rail.width };
    setRailResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onRailResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = railDrag.current;
    if (!drag) return;
    // Dragging left widens the rail.
    const width = clampRailWidth(drag.startWidth + (drag.startX - e.clientX));
    updateRail((prev) => ({ ...prev, width }));
  };

  const onRailResizeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!railDrag.current) return;
    railDrag.current = null;
    setRailResizing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onRailResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowLeft" ? 16 : -16;
    updateRail((prev) => ({ ...prev, width: clampRailWidth(prev.width + delta) }));
  };

  if (isPending) {
    return <TeacherOverviewSkeleton />;
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load your overview.</p>
      </section>
    );
  }

  const isAdviser = !!data.advisorySection;
  const classStudents = data.classStudents ?? [];
  const studentCount = isAdviser
    ? (data.advisoryTotal ?? data.advisory.students.length)
    : (data.classStudentsTotal ?? classStudents.length);
  const atRiskFactors = isAdviser
    ? data.atRiskFactors
    : data.classAtRiskFactors
      ? {
          academic: data.classAtRiskFactors.academic,
          attendance: data.classAtRiskFactors.attendance,
          behavioral: 0,
        }
      : {
          academic: classStudents.filter((s) => s.flags.includes("academic")).length,
          attendance: classStudents.filter((s) => s.flags.includes("attendance")).length,
          behavioral: 0,
        };
  const atRiskStudents = isAdviser
    ? data.atRiskStudents
    : classStudents.filter((s) => s.riskLevel !== "Low").length;

  // Nothing assigned this term → one centered callout instead of empty boards.
  if (!data.advisorySection && data.kpi.classCount === 0) {
    return (
      <section className={styles.page}>
        <PageEmptyCallout>
          No classes or advisees are assigned to you for the selected term yet.
          Sections and subjects assigned to you will appear here.
        </PageEmptyCallout>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div
        className={`${styles.body} ${rail.collapsed ? styles.bodyCollapsed : ""} ${railResizing ? styles.bodyResizing : ""}`}
        style={{ ["--rail-width" as string]: `${rail.width}px` } as React.CSSProperties}
      >
        <div className={styles.mainCol}>
          <TeacherOverviewCharts
            overview={data}
            factors={atRiskFactors}
            hideBehavioral={!isAdviser}
          />
        </div>

        <aside
          className={`${styles.sideCol} ${rail.collapsed ? styles.sideColCollapsed : ""}`}
          style={{ top: "4rem" }}
        >
          <div
            className={`${styles.railLayer} ${styles.railExpanded}`}
            aria-hidden={rail.collapsed}
            inert={rail.collapsed}
          >
            <div className={styles.railHead}>
              <span className={styles.railTitle}>My day</span>
              <button
                type="button"
                className={styles.railToggle}
                onClick={toggleRail}
                aria-label="Collapse side panel to icons"
                title="Collapse to icons"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
            <TeacherOverviewKanban
              teacherName={data.teacherName}
              advisorySection={data.advisorySection}
              classCount={data.kpi.classCount}
              studentCount={studentCount}
              atRiskFactors={atRiskFactors}
              atRiskStudents={atRiskStudents}
              populationLabel={isAdviser ? "advisees" : "students"}
              hideBehavioral={!isAdviser}
              storageKey={`teacher-kanban:${prefetchTeacherId ?? data.teacherName}:${termKey}`}
            />
          </div>

          <div
            className={`${styles.railLayer} ${styles.railIcons}`}
            aria-hidden={!rail.collapsed}
            inert={!rail.collapsed}
          >
            <div className={styles.railStack}>
              <button
                type="button"
                className={`${styles.railCard} ${styles.railCardNeutral}`}
                onClick={toggleRail}
                aria-label="Expand side panel"
                title="Expand side panel"
              >
                <ChevronLeft size={16} aria-hidden className={styles.railIcon} />
              </button>
              <button
                type="button"
                className={styles.railCard}
                onClick={toggleRail}
                aria-label="Expand side panel to profile"
                title={data.teacherName}
              >
                <User size={16} aria-hidden className={styles.railIcon} />
              </button>
              <button
                type="button"
                className={styles.railCard}
                onClick={toggleRail}
                aria-label={`Expand side panel to needs attention, ${atRiskStudents} at risk`}
                title={`Needs attention · ${atRiskStudents}`}
              >
                <ShieldAlert size={16} aria-hidden className={styles.railIcon} />
                <span className={styles.railBadge}>{atRiskStudents}</span>
              </button>
            </div>
          </div>

          {!rail.collapsed ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize side panel"
              aria-valuemin={RAIL_MIN_WIDTH}
              aria-valuemax={RAIL_MAX_WIDTH}
              aria-valuenow={rail.width}
              tabIndex={0}
              className={styles.railResize}
              onPointerDown={onRailResizeStart}
              onPointerMove={onRailResizeMove}
              onPointerUp={onRailResizeEnd}
              onPointerCancel={onRailResizeEnd}
              onKeyDown={onRailResizeKeyDown}
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}
