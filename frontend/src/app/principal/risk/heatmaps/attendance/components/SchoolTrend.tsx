"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  DotProps,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Check, ChevronDown, MessageSquareText } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TrendPoint } from "../../components/types";
import styles from "./SchoolTrend.module.css";

type Session = "AM" | "PM";

function buildInterpretation(
  points: TrendPoint[],
  session: Session,
  termNumber: number | undefined
): string[] {
  const lines: string[] = [];
  if (points.length === 0) {
    return ["No school days have elapsed yet — nothing to interpret so far."];
  }
  const rates = points.map((p) => p.rate);
  const avg = rates.reduce((a, r) => a + r, 0) / rates.length;
  const scope = termNumber ? `Term ${termNumber}` : "this term";

  lines.push(
    `Daily present percentage of the enrollable headcount for the ${session} session — averaging ${Math.round(avg)}% across ${points.length} school days in ${scope}.`
  );

  if (points.length >= 4) {
    const half = Math.floor(points.length / 2);
    const first = rates.slice(0, half).reduce((a, r) => a + r, 0) / half;
    const second =
      rates.slice(half).reduce((a, r) => a + r, 0) / (rates.length - half);
    const diff = second - first;
    if (diff > 2) {
      lines.push("Trend is improving — recent days run above the early-term average.");
    } else if (diff < -2) {
      lines.push("Trend is slipping — recent days run below the early-term average.");
    } else {
      lines.push("Trend is steady — recent days match the early-term average.");
    }
  }

  const below = rates.filter((r) => r < 80).length;
  lines.push(
    below === 0
      ? "Every plotted day stays at or above the 80% mark — attendance on track."
      : `${below} of ${rates.length} plotted day${below === 1 ? "" : "s"} fall${below === 1 ? "s" : ""} below 80% — at risk, needs attention.`
  );

  return lines;
}

const chartConfig = {
  rate: {
    label: "Present",
    theme: { light: "#171717", dark: "#fafafa" },
  },
} satisfies ChartConfig;

function TrendDot(props: DotProps & { payload?: TrendPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return <g />;
  const bad = payload.rate < 80;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={bad ? 4.5 : 3.5}
      fill={bad ? "var(--destructive)" : "var(--color-rate)"}
      stroke="var(--card)"
      strokeWidth={1.5}
    />
  );
}

export function SchoolTrend({
  session,
  onSessionChange,
}: {
  session: Session;
  onSessionChange: (s: Session) => void;
}) {
  const { data, isPending } = useQuery({
    queryKey: ["attendance-school-trend", session],
    queryFn: async () => {
      const res = await apiClient.get<{
        trend: TrendPoint[];
        schoolDays: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/section-stats", { params: { session } });
      return res.data;
    },
    staleTime: 30_000,
  });

  const points = React.useMemo(() => data?.trend ?? [], [data]);
  const termNumber = data?.term?.termNumber;
  const bestDay = React.useMemo(
    () =>
      points.length > 0
        ? points.reduce((a, b) => (b.rate > a.rate ? b : a))
        : null,
    [points]
  );
  const worstDay = React.useMemo(
    () =>
      points.length > 0
        ? points.reduce((a, b) => (b.rate < a.rate ? b : a))
        : null,
    [points]
  );
  const lines = React.useMemo(
    () => (!isPending ? buildInterpretation(points, session, termNumber) : []),
    [points, session, termNumber, isPending]
  );
  const hasStatusBadge = !isPending && points.length > 0 && lines.length > 0;
  const bodyLines = hasStatusBadge ? lines.slice(0, -1) : lines;
  const statusLine = hasStatusBadge ? lines[lines.length - 1] : null;
  const atRisk = statusLine?.includes("needs attention") ?? false;

  return (
    <div className={styles.content}>
      <div className={styles.toolbar}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>School-wide Trend</h1>
          <p className={styles.subtitle}>
            Daily present percentage of the enrollable headcount for the{" "}
            {session} session
            {termNumber ? ` · Term ${termNumber}` : ""}.
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
        <>
          <Skeleton className={styles.skelChart} />
          <Skeleton className={styles.skelLine} />
          <Skeleton className={styles.skelLineShort} />
        </>
      ) : points.length === 0 ? (
        <p className={styles.empty}>
          No trend data yet — blocks appear once school days elapse.
        </p>
      ) : (
        <>
          <div className={styles.chartWrap}>
            <ChartContainer config={chartConfig} className={styles.chart}>
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  minTickGap={28}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => `${label}`}
                      formatter={(value) => `${value}%`}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--color-rate)"
                  strokeWidth={2}
                  dot={<TrendDot />}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          </div>

          {bestDay && worstDay ? (
            <div className={styles.dayRow}>
              <div className={styles.dayCard}>
                <p className={styles.dayLabel}>Strongest day</p>
                <p className={styles.dayDate}>{bestDay.date}</p>
                <p className={styles.dayRate}>{bestDay.rate}%</p>
              </div>
              <div className={styles.dayCard}>
                <p className={styles.dayLabel}>Weakest day</p>
                <p className={styles.dayDate}>{worstDay.date}</p>
                <p className={styles.dayRate}>{worstDay.rate}%</p>
              </div>
            </div>
          ) : null}

          <div className={styles.messageCol}>
            <p className={styles.messageHead}>
              <MessageSquareText className={styles.messageIcon} aria-hidden />
              What this means
            </p>
            <ul className={styles.messageList}>
              {bodyLines.map((line, i) => (
                <li key={i} className={styles.messageLine}>
                  {line}
                </li>
              ))}
            </ul>
            {statusLine ? (
              <Badge
                variant={atRisk ? "destructive" : "success"}
                className={styles.statusBadge}
              >
                {statusLine}
              </Badge>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
