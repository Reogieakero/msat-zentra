"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  selectedSectionId,
  onSelectSection,
}: {
  session: Session;
  onSessionChange: (s: Session) => void;
  selectedSectionId?: string | null;
  onSelectSection?: (id: string | null) => void;
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  const { data, isPending } = useQuery({
    queryKey: ["attendance-section-heatmap", session],
    queryFn: async () => {
      const res = await apiClient.get<{ sections: Row[] }>(
        "/api/attendance/section-heatmap",
        { params: { session } }
      );
      return res.data;
    },
  });

  const sections = React.useMemo(() => data?.sections ?? [], [data]);

  const bands = React.useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const s of sections) {
      const arr = map.get(s.gradeLevel) ?? [];
      arr.push(s);
      map.set(s.gradeLevel, arr);
    }
    return Array.from(map.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [sections]);

  React.useEffect(() => {
    if (!selectedSectionId || !scrollerRef.current) return;
    const el = scrollerRef.current.querySelector<HTMLElement>(
      `[data-section-id="${selectedSectionId}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedSectionId, sections]);

  const scrollBy = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Section Attendance Heatblocks</CardTitle>
          <CardDescription>
            Per-section daily attendance for the {session} session. Select a
            card to drill into its students below.
          </CardDescription>
        </div>
        <CardAction className={styles.headerActions}>
          <Tabs
            value={session}
            onValueChange={(v) => onSessionChange(v as Session)}
          >
            <TabsList className={styles.tabsList}>
              {(["AM", "PM"] as Session[]).map((s) => (
                <TabsTrigger key={s} value={s} className={styles.tabsTrigger}>
                  {s}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollBy(-1)}
              aria-label="Scroll left"
            >
              <ChevronLeft className={styles.arrowIcon} aria-hidden />
            </button>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollBy(1)}
              aria-label="Scroll right"
            >
              <ChevronRight className={styles.arrowIcon} aria-hidden />
            </button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className={styles.content}>
        {isPending ? (
          <div className={styles.scroller}>
            <div className={styles.row}>
              {Array.from({ length: 5 }).map((_, i) => (
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
          </div>
        ) : sections.length === 0 ? (
          <p className={styles.empty}>No attendance data available.</p>
        ) : (
          <TooltipProvider>
            <div className={styles.scroller} ref={scrollerRef}>
              <div className={styles.row}>
                {bands.map(([, rows]) =>
                  rows.map((s) => (
                    <article
                      key={s.sectionId}
                      data-section-id={s.sectionId}
                      className={`${styles.cardShell} ${
                        selectedSectionId === s.sectionId ? styles.shellSelected : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={styles.shellBtn}
                        onClick={() =>
                          onSelectSection?.(
                            selectedSectionId === s.sectionId ? null : s.sectionId
                          )
                        }
                        aria-pressed={selectedSectionId === s.sectionId}
                      >
                        <span className={styles.grade}>{s.section}</span>
                        <span className={styles.enrolled}>
                          <CalendarRange className={styles.enrolledIcon} aria-hidden />
                          {s.enrolled} students
                        </span>
                      </button>
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
                  ))
                )}
              </div>
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
      </CardContent>
    </Card>
  );
}
