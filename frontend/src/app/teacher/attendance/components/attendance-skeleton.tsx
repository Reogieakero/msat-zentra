"use client";

import { Skeleton } from "@/components/ui/skeleton";
import railStyles from "./AttendanceRosterRail.module.css";
import sheetStyles from "./AttendanceSheet.module.css";
import skel from "./attendance-skeleton.module.css";

const RAIL_SKELETON_ROWS = 10;
const SHEET_SKELETON_ROWS = 8;

/* Roster-rail placeholders — same .summary / .list / .skelItem structure as
   the loaded rail, including the attendance-rate and status-dot slots real
   rows render. The search input stays live above the list. */
export function RosterRailSummarySkeleton() {
  return (
    <div className={railStyles.summary} aria-hidden="true">
      <Skeleton className={railStyles.skelSection} />
      <Skeleton className={railStyles.skelMeta} />
    </div>
  );
}

export function RosterRailListSkeleton({ rows = RAIL_SKELETON_ROWS }: { rows?: number }) {
  return (
    <ul className={railStyles.list} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className={railStyles.skelItem}>
          <Skeleton className={railStyles.skelAvatar} />
          <Skeleton className={railStyles.skelName} />
          <Skeleton className={skel.skelRate} />
          <Skeleton className={skel.skelDot} />
        </li>
      ))}
    </ul>
  );
}

/* Sheet-row placeholders — same .rows / .row / .identity / .segTabs
   structure as loaded rows, with per-status segment widths matching the
   real Present / Absent / Late / Excused buttons. Header, footer, and
   search stay live above and below this. */
export function SheetRowsSkeleton({ rows = SHEET_SKELETON_ROWS }: { rows?: number }) {
  return (
    <ul className={sheetStyles.rows} aria-busy="true" aria-label="Loading roster">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className={sheetStyles.row} aria-hidden>
          <span className={sheetStyles.identity}>
            <Skeleton className={sheetStyles.skelAvatar} />
            <span className={sheetStyles.nameWrap}>
              <Skeleton className={sheetStyles.skelName} />
              <Skeleton className={sheetStyles.skelLrn} />
            </span>
          </span>
          <span className={sheetStyles.segTabs} aria-hidden>
            <Skeleton className={`${skel.skelSeg} ${skel.skelSegPresent}`} />
            <Skeleton className={`${skel.skelSeg} ${skel.skelSegAbsent}`} />
            <Skeleton className={`${skel.skelSeg} ${skel.skelSegLate}`} />
            <Skeleton className={`${skel.skelSeg} ${skel.skelSegExcused}`} />
          </span>
        </li>
      ))}
    </ul>
  );
}
