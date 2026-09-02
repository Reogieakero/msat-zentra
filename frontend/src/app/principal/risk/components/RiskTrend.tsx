"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { apiClient } from "@/lib/api/client";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { RISK_LEVEL_COLORS } from "../riskData";
import type { RiskTrendData } from "../riskBoard";
import styles from "./RiskTrend.module.css";

type SchoolYearOption = {
  id: string;
  name: string;
  isActive: boolean;
  isCurrent: boolean;
  terms: { id: string; termNumber: number }[];
};

const chartConfig = {
  high: { label: "High risk", color: RISK_LEVEL_COLORS.High },
  moderate: { label: "Moderate", color: RISK_LEVEL_COLORS.Moderate },
  low: { label: "Low risk", color: RISK_LEVEL_COLORS.Low },
} satisfies ChartConfig;

const SERIES = [
  { key: "high", color: RISK_LEVEL_COLORS.High },
  { key: "moderate", color: RISK_LEVEL_COLORS.Moderate },
  { key: "low", color: RISK_LEVEL_COLORS.Low },
] as const;

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All" },
] as const;

type RangeKey = (typeof RANGES)[number]["value"];

async function fetchSchools(): Promise<SchoolYearOption[]> {
  const res = await apiClient.get<SchoolYearOption[]>("/api/risk/school-years");
  return res.data;
}

export function RiskTrend() {
  const gradId = React.useId().replace(/:/g, "");

  const [yearChoice, setYearChoice] = usePersistentState<string>(
    "zentra.risk.trend.year",
    "auto"
  );
  const [termChoice, setTermChoice] = usePersistentState<string>(
    "zentra.risk.trend.term",
    "auto"
  );
  const [range, setRange] = usePersistentState<RangeKey>(
    "zentra.risk.trend.range",
    "all"
  );

  const { data: schoolYears = [] } = useQuery({
    queryKey: ["risk-school-years"],
    queryFn: fetchSchools,
  });

  const activeYear =
    schoolYears.find((y) => y.isCurrent) ??
    schoolYears.find((y) => y.isActive) ??
    schoolYears[0] ??
    null;

  const chosenYear =
    yearChoice === "auto"
      ? activeYear
      : (schoolYears.find((y) => y.id === yearChoice) ?? activeYear);

  const terms = chosenYear?.terms ?? [];
  const chosenTerm =
    termChoice === "all"
      ? null
      : termChoice === "auto"
        ? (chosenYear?.terms[0] ?? null)
        : (terms.find((t) => t.id === termChoice) ?? chosenYear?.terms[0] ?? null);

  const effectiveTermId = chosenTerm?.id;

  const { data, isPending } = useQuery({
    // Key on the *resolved* ids (not the raw "auto" choices) so the query
    // waits until a year/term is actually resolved and refires when the
    // effective selection changes.
    queryKey: ["risk-trend", chosenYear?.id, effectiveTermId ?? "none"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (chosenYear) params.schoolYearId = chosenYear.id;
      if (effectiveTermId) params.termId = effectiveTermId;
      const res = await apiClient.get<RiskTrendData>("/api/risk/trend", { params });
      return res.data;
    },
    enabled: chosenYear !== null,
  });

  const isDaily = effectiveTermId !== undefined;

  const onYearChange = (value: string) => {
    setYearChoice(value);
    const year =
      value === "auto"
        ? activeYear
        : (schoolYears.find((y) => y.id === value) ?? activeYear);
    const first = year?.terms[0];
    setTermChoice(first ? first.id : value === "auto" ? "auto" : "all");
  };

  const trend = data?.trend ?? [];
  let chartData = trend.map((t) => ({
    date: t.date,
    term: t.term,
    high: isPending ? 0 : t.high,
    moderate: isPending ? 0 : t.moderate,
    low: isPending ? 0 : t.low,
  }));

  if (isDaily && range !== "all") {
    const n = Number(range);
    const dates = chartData.map((d) => d.date).filter(Boolean);
    if (dates.length > 0) {
      const max = dates.reduce((a, b) => (a > b ? a : b));
      const maxDate = new Date(`${max}T00:00:00`);
      maxDate.setDate(maxDate.getDate() - (n - 1));
      const cutoff = maxDate.getTime();
      chartData = chartData.filter((d) => {
        if (!d.date) return false;
        return new Date(`${d.date}T00:00:00`).getTime() >= cutoff;
      });
    }
  }

  const hasData = chartData.length > 0;

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>Risk Trend</h2>
          <p className={styles.subtitle}>
            {isDaily
              ? "Total for the selected term"
              : "School-wide risk trend by term"}
          </p>
        </div>
        <div className={styles.filters}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`${styles.filterBtn} ${
                  yearChoice !== "auto" ? styles.filterActive : ""
                }`}
              >
                School Year
                {yearChoice !== "auto" && (
                  <span className={styles.filterDot} aria-hidden />
                )}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={yearChoice === "auto"}
                onCheckedChange={() => onYearChange("auto")}
              >
                All (active year)
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {schoolYears.length === 0 ? (
                <DropdownMenuItem disabled>No school years</DropdownMenuItem>
              ) : (
                schoolYears.map((y) => (
                  <DropdownMenuCheckboxItem
                    key={y.id}
                    checked={yearChoice === y.id}
                    onCheckedChange={() => onYearChange(y.id)}
                  >
                    {y.name}
                    {y.isActive ? " • Active" : ""}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={styles.filterBtn}
                disabled={terms.length === 0}
              >
                Term
                {effectiveTermId !== undefined && (
                  <span className={styles.filterDot} aria-hidden />
                )}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              <DropdownMenuCheckboxItem
                checked={termChoice === "all"}
                onCheckedChange={() => setTermChoice("all")}
              >
                All terms
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {terms.length === 0 ? (
                <DropdownMenuItem disabled>No terms</DropdownMenuItem>
              ) : (
                terms.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t.id}
                    checked={chosenTerm?.id === t.id}
                    onCheckedChange={() => setTermChoice(t.id)}
                  >
                    Term {t.termNumber}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card className={styles.card}>
        <CardHeader className={styles.cardHeader}>
          <CardDescription className={styles.cardDesc}>
            {isDaily
              ? "Daily risk levels for the selected term"
              : "Risk levels aggregated per term"}
          </CardDescription>
          <CardAction className={styles.cardActions}>
            {isDaily && (
              <div className={styles.rangeGroup}>
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className={`${styles.rangeBtn} ${
                      range === r.value ? styles.rangeActive : ""
                    }`}
                    onClick={() => setRange(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className={styles.skeleton} />
          ) : !hasData ? (
            <p className={styles.empty}>
              No risk trend data available for the selected school year and
              term.
            </p>
          ) : (
            <div className={styles.chartBox}>
              <ChartContainer
                config={chartConfig}
                className={styles.chartContainer}
              >
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, bottom: 8, left: 4 }}
                >
                  <defs>
                    {SERIES.map((s) => (
                      <linearGradient
                        key={s.key}
                        id={`${gradId}-${s.key}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={s.color}
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor={s.color}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="term"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={isDaily ? 24 : 0}
                    interval={isDaily ? "preserveStartEnd" : 0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {SERIES.map((s) => (
                    <Area
                      key={s.key}
                      dataKey={s.key}
                      name={s.key}
                      type="monotone"
                      stroke={s.color}
                      strokeWidth={2}
                      fill={`url(#${gradId}-${s.key})`}
                      dot={false}
                    />
                  ))}
                  <ChartLegend
                    verticalAlign="top"
                    align="right"
                    content={<ChartLegendContent />}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
