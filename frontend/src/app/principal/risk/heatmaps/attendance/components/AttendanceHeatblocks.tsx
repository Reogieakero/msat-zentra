"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./AttendanceHeatblocks.module.css";

type Session = "AM" | "PM";
type Row = {
  sectionId: string;
  section: string;
  gradeLevel: string;
  enrolled: number;
  days: {
    date: string;
    isoDate: string;
    present: number;
    late: number;
    absent: number;
    excused: number;
    ratio: number;
    isWeekend: boolean;
  }[];
};

// Brand-derived scale mirrors the attendance map tokens (--hm-*).
const SCALE = "var(--hm-0) var(--hm-1) var(--hm-2) var(--hm-3) var(--hm-4)".split(" ");

// Color by the canonical present ratio (0..100) computed by the backend engine —
// single source of truth shared with the overview trend/table/alerts.
function ratioColor(ratio: number): string {
  if (ratio <= 0) return SCALE[0];
  if (ratio >= 90) return SCALE[4];
  if (ratio >= 80) return SCALE[3];
  if (ratio >= 50) return SCALE[2];
  return SCALE[1];
}

export function AttendanceHeatblocks({
  session,
  onSessionChange,
}: {
  session: Session;
  onSessionChange: (s: Session) => void;
}) {
  const { data, isPending } = useQuery({
    queryKey: ["attendance-section-heatmap", session],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: Row[];
        term?: { id: string; termNumber: number };
      }>("/api/attendance/section-heatmap", { params: { session } });
      return res.data;
    },
  });

  // Every section in the school in one 3-per-row grid — no strip, no
  // scrolling. Sections arrive grade-ordered from the backend.
  const sections = React.useMemo(() => data?.sections ?? [], [data]);
  const termNumber = data?.term?.termNumber;

  return (
    <div className={styles.content}>
      <div className={styles.toolbar}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Section Attendance Heatblocks</h1>
          <p className={styles.subtitle}>
            Daily attendance for every section of the school — {session}{" "}
            session
            {termNumber ? ` · Term ${termNumber}` : ""}, color-coded against
            the 80% threshold.
          </p>
        </div>
        <div className={styles.toolbarRight}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Session filter"
              >
                {session} session
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["AM", "PM"] as Session[]).map((s) => (
                <DropdownMenuItem
                  key={s}
                  onSelect={() => onSessionChange(s)}
                >
                  {session === s ? <Check aria-hidden /> : <span className={styles.checkSpacer} />}
                  <span>{s} session</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isPending ? (
        <div className={styles.gridCards}>
          {Array.from({ length: 6 }).map((_, i) => (
            <article key={i} className={styles.cardShell} aria-hidden>
              <Skeleton className={styles.skelGrade} />
              <div className={styles.grid}>
                {Array.from({ length: 36 }).map((__, j) => (
                  <Skeleton key={j} className={styles.skelBlock} />
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : sections.length === 0 ? (
        <p className={styles.empty}>No attendance data available.</p>
      ) : (
        <TooltipProvider>
          <div className={styles.gridCards}>
            {sections.map((s) => (
              <article
                key={s.sectionId}
                data-section-id={s.sectionId}
                className={styles.cardShell}
              >
                <div className={styles.shellHead}>
                  <span className={styles.grade}>{s.section}</span>
                  <span className={styles.enrolled}>
                    <CalendarRange className={styles.enrolledIcon} aria-hidden />
                    {s.enrolled} students
                  </span>
                </div>
                <div className={styles.grid}>
                  {s.days.map((d) => (
                    <Tooltip key={d.date}>
                      <TooltipTrigger asChild>
                        <span
                          className={`${styles.block} ${
                            d.isWeekend ? styles.blockWeekend : ""
                          }`}
                          style={{
                            background: d.isWeekend
                              ? "var(--hm-weekend)"
                              : ratioColor(d.ratio),
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className={styles.tooltipLine}>
                          <span>
                            {d.date} &middot; {session}
                          </span>
                          <span>
                            {d.present} present &middot; {d.late} late
                            &middot; {d.absent} absent &middot; {d.excused}{" "}
                            excused
                          </span>
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className={styles.legend}>
            <span className={styles.legendLabel}>Present: 0</span>
            <span className={styles.legendSwatches}>
              {SCALE.map((c, i) => (
                <span
                  key={i}
                  className={styles.legendSwatch}
                  style={{ background: c }}
                />
              ))}
            </span>
            <span className={styles.legendLabel}>= enrolled</span>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
