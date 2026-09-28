"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Check,
  ChevronDown,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SectionAttendanceStat } from "../../components/types";
import styles from "./SectionAverages.module.css";

type Session = "AM" | "PM";

function trendIcon(trend: SectionAttendanceStat["trend"]) {
  if (trend === "up")
    return <ArrowUpRight className={styles.trendUp} aria-label="Trending up" />;
  if (trend === "down")
    return (
      <ArrowDownRight className={styles.trendDown} aria-label="Trending down" />
    );
  return <Minus className={styles.trendFlat} aria-label="Steady" />;
}

export function SectionAverages({
  session,
  onSessionChange,
}: {
  session: Session;
  onSessionChange: (s: Session) => void;
}) {
  const { data, isPending } = useQuery({
    queryKey: ["attendance-section-averages", session],
    queryFn: async () => {
      const res = await apiClient.get<{
        sections: SectionAttendanceStat[];
        schoolDays: number;
        totalEnrolled: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/section-stats", { params: { session } });
      return res.data;
    },
    staleTime: 30_000,
  });
  const termNumber = data?.term?.termNumber;

  // Worst first — sections furthest below the 80% mark float to the top.
  const sections = React.useMemo(
    () => [...(data?.sections ?? [])].sort((a, b) => a.rate - b.rate),
    [data]
  );
  const below = sections.filter((s) => s.rate < 80).length;

  return (
    <div className={styles.content}>
      <div className={styles.toolbar}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Section Averages</h1>
          <p className={styles.subtitle}>
            Average present-per-day and how many days each section dipped below
            80% — {session} session
            {termNumber ? ` · Term ${termNumber}` : ""},{" "}
            {data?.schoolDays ?? 0} school days.
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
                <DropdownMenuItem key={s} onSelect={() => onSessionChange(s)}>
                  {session === s ? (
                    <Check aria-hidden />
                  ) : (
                    <span className={styles.checkSpacer} />
                  )}
                  <span>{s} session</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isPending ? (
        <div className={styles.kpis}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className={styles.skelKpi} />
          ))}
        </div>
      ) : (
        <dl className={styles.kpis}>
          <div className={styles.kpi}>
            <dt>Total enrolled</dt>
            <dd>{data?.totalEnrolled ?? 0}</dd>
          </div>
          <div className={styles.kpi}>
            <dt>Sections tracked</dt>
            <dd>{sections.length}</dd>
          </div>
          <div className={styles.kpi}>
            <dt>Below 80%</dt>
            <dd>{below}</dd>
          </div>
          <div className={styles.kpi}>
            <dt>School days</dt>
            <dd>{data?.schoolDays ?? 0}</dd>
          </div>
        </dl>
      )}

      {isPending ? (
        <Skeleton className={styles.skelTable} />
      ) : sections.length === 0 ? (
        <p className={styles.empty}>No section data available.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Section</th>
                <th scope="col" className={styles.num}>Enrolled</th>
                <th scope="col" className={styles.num}>Attendance %</th>
                <th scope="col" className={styles.num}>Below 80%</th>
                <th scope="col" className={styles.num}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.sectionId} data-bad={s.rate < 80 ? true : undefined}>
                  <td>
                    <span className={styles.sectionName}>{s.section}</span>
                    <span className={styles.gradeLevel}>Grade {s.gradeLevel}</span>
                  </td>
                  <td className={styles.num}>{s.enrolled}</td>
                  <td className={styles.num}>
                    <span className={styles.rate}>{s.rate}%</span>
                  </td>
                  <td className={styles.num}>
                    {s.belowDays} day{s.belowDays === 1 ? "" : "s"}
                  </td>
                  <td className={styles.num}>{trendIcon(s.trend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
