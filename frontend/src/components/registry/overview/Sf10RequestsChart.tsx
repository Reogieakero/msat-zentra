"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { FileStack } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  fetchRecordKeeperOverview,
  fetchRegistrarOverview,
  type RegistryDesk,
} from "@/services/registry/overview.service";
import type { RegistryRequestDayRow } from "@/services/registry/overview.types";
import styles from "./Sf10RequestsChart.module.css";

/* One area per request status — amber pending, emerald approved, red
   reported missing, violet denied. */
const chartConfig = {
  pending: { label: "Pending", color: "#f59e0b" },
  approved: { label: "Approved", color: "#10b981" },
  reported: { label: "Reported", color: "#ef4444" },
  denied: { label: "Denied", color: "#8b5cf6" },
} satisfies ChartConfig;

const SERIES = ["pending", "approved", "reported", "denied"] as const;

// Fixed window — the chart shows (and counts) the trailing 30 days of
// activity. Exported so the adviser-access rail counts the same number.
export const SF10_REQUESTS_WINDOW_DAYS = 30;

/** Requests submitted (pending events) inside the trailing window. */
export function countSubmittedRequests(
  rows: RegistryRequestDayRow[] | undefined,
) {
  return (rows ?? [])
    .slice(-SF10_REQUESTS_WINDOW_DAYS)
    .reduce((sum, row) => sum + row.pending, 0);
}

// Parse as local midnight so the tick never shows the previous day.
function formatDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function Sf10RequestsChart({
  desk,
  className = "flex-1",
}: {
  desk: RegistryDesk;
  /** Card chrome override — pass "border-0" when embedded in a rail flyout. */
  className?: string;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: [`${desk}-overview`],
    queryFn: desk === "registrar" ? fetchRegistrarOverview : fetchRecordKeeperOverview,
    staleTime: 30_000,
  });

  const allRows = React.useMemo(() => data?.sf10RequestsDaily ?? [], [data]);
  const rows = React.useMemo(
    () => allRows.slice(-SF10_REQUESTS_WINDOW_DAYS),
    [allRows]
  );

  // Only plot series that recorded activity inside the window. A stacked
  // series that is zero everywhere still paints its stroke flat along the
  // top of the stack (and the baseline), covering the whole line even when
  // it has no activity. Filtering keeps every visible line backed by a
  // matching legend entry.
  const activeSeries = React.useMemo(
    () => SERIES.filter((key) => rows.some((r) => r[key] > 0)),
    [rows]
  );

  // Requests submitted inside the selected window.
  const submitted = countSubmittedRequests(allRows);
  const hasActivity = allRows.some(
    (r) => r.pending + r.approved + r.reported + r.denied > 0
  );
  const isEmpty = !isPending && !isError && !hasActivity;

  const body = isPending ? (
    <Skeleton className={styles.skel} />
  ) : isError ? (
    <p className={styles.empty}>Could not load access-request activity.</p>
  ) : isEmpty ? (
    <div className={styles.emptyBlock}>
      <span className={styles.emptyIcon} aria-hidden>
        <FileStack />
      </span>
      <p className={styles.emptyTitle}>No access requests yet</p>
      <p className={styles.emptyHint}>
        Adviser SF10 access requests and their approvals, missing reports, and
        denials appear here day by day.
      </p>
    </div>
  ) : (
    <>
      <ChartContainer
        config={chartConfig}
        className={`aspect-auto h-36 w-full ${styles.chartIn}`}
      >
        <AreaChart data={rows} margin={{ left: 0, right: 8, top: 4 }}>
          <defs>
            {activeSeries.map((key) => (
              <linearGradient
                key={key}
                id={`fill-sf10-${key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={`var(--color-${key})`}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${key})`}
                  stopOpacity={0.1}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(value) => formatDay(value as string)}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelFormatter={(value) => formatDay(value as string)}
              />
            }
          />
          {activeSeries.map((key) => (
            <Area
              key={key}
              dataKey={key}
              type="monotone"
              stackId="a"
              fill={`url(#fill-sf10-${key})`}
              stroke={`var(--color-${key})`}
              strokeWidth={1.5}
              animationDuration={600}
              animationEasing="ease-out"
            />
          ))}
          <ChartLegend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
    </>
  );

  return (
    <KanbanBoard
      className={className}
      title="SF10 Access Requests"
      icon={
        <span className="text-amber-500" aria-hidden>
          <FileStack size={14} />
        </span>
      }
      count={isPending ? undefined : isError ? "—" : submitted}
      description="Requests submitted, students approved or reported missing, and denials per day — last 30 days."
    >
      <div className={styles.kanbanBody}>{body}</div>
    </KanbanBoard>
  );
}
