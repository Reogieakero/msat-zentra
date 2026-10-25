"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Pie, PieChart, Cell, Tooltip } from "recharts";
import { FileText, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { usePrimaryScale } from "@/components/risk-dashboard/use-primary-scale";
import { usePrincipalProfileSettings } from "@/services/settings/profile-settings";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import {
  CATEGORY_KEYS,
  CATEGORY_META,
  fetchRecords,
} from "@/services/principal/records.service";
import styles from "./RecordsOverview.module.css";

const chartConfig = {
  value: { label: "Records", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface Kpi {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

function DonutTooltip({
  active,
  payload,
  total,
  colorForKey,
}: {
  active?: boolean;
  payload?: {
    value?: string | number;
    payload?: { key?: string; value?: number };
  }[];
  total: number;
  colorForKey: (key: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  const key = datum?.key ?? "";
  const value = Number(payload[0]?.value ?? datum?.value ?? 0);
  const meta = key
    ? CATEGORY_META[key as keyof typeof CATEGORY_META]
    : undefined;
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={TOOLTIP_STYLE} className="flex flex-col gap-1 px-2.5 py-2">
      <p className="m-0 flex items-center gap-2 font-semibold">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ background: colorForKey(key) }}
        />
        {meta?.label ?? key}
      </p>
      <p className="m-0 flex items-baseline justify-between gap-4 tabular-nums">
        <span style={{ color: "var(--muted-foreground)" }}>
          {value.toLocaleString()} record{value === 1 ? "" : "s"}
        </span>
        <span className="font-bold">{pct}%</span>
      </p>
    </div>
  );
}

/**
 * Breakdown contents for the records desk — stats, category donut and the
 * heaviest-record students. Lives inside the right rail's flyout kanban board
 * (same interaction as the principal overview rail), so it ships without any
 * card chrome of its own.
 */
export function RecordsBreakdownContent() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
  });

  const allStudents = React.useMemo(
    () => data?.sections.flatMap((s) => s.students) ?? [],
    [data]
  );

  const allRecords = React.useMemo(
    () => allStudents.flatMap((s) => s.behavioral),
    [allStudents]
  );

  const categoryRows = React.useMemo(() => {
    const map = new Map<string, { key: string; value: number }>();
    for (const key of CATEGORY_KEYS) {
      map.set(key, { key, value: 0 });
    }
    for (const rec of allRecords) {
      const row = map.get(rec.category);
      if (row) row.value += 1;
    }
    return Array.from(map.values())
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [allRecords]);

  const categoryTotal = categoryRows.reduce((s, r) => s + r.value, 0);

  const profile = usePrincipalProfileSettings();
  const scale = usePrimaryScale(
    Math.max(categoryRows.length, 1),
    profile.data?.primaryColor
  );
  const sliceColor = (i: number) => scale[i % scale.length] ?? "#888888";

  const kpis: Kpi[] = [
    {
      icon: FileText,
      label: "Total records",
      value: allRecords.length.toLocaleString(),
    },
    {
      icon: Users,
      label: "Students tracked",
      value: allStudents.length.toLocaleString(),
    },
  ];

  if (isPending) {
    return (
      <div className={styles.rowSkel}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className={styles.rowSkelItem} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className={styles.empty}>Could not load student records.</p>;
  }

  if (categoryRows.length === 0) {
    return (
      <PrincipalEmptyState
        icon={FileText}
        title="No records this term"
        hint="No behavioral records filed for the active term. New records will appear here once filed."
      />
    );
  }

  return (
    <div className={styles.content}>
      <div className={styles.statRow}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.statItem}>
            <span className={styles.statValue}>{k.value}</span>
            <span className={styles.statLabel}>{k.label}</span>
            {/* Overview-style accent: plain amber glyph on the right. */}
            <span className={styles.statIcon} aria-hidden>
              <k.icon size={14} />
            </span>
          </div>
        ))}
      </div>

      <div className={styles.donutWrap}>
        <ChartContainer config={chartConfig} className={styles.donut}>
          <PieChart>
            <Tooltip
              content={
                <DonutTooltip
                  total={categoryTotal}
                  colorForKey={(key) => {
                    const i = categoryRows.findIndex((r) => r.key === key);
                    return sliceColor(Math.max(0, i));
                  }}
                />
              }
              contentStyle={TOOLTIP_STYLE}
            />
            <Pie
              data={categoryRows}
              dataKey="value"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={64}
              paddingAngle={2}
              strokeWidth={0}
            >
              {categoryRows.map((entry, i) => (
                <Cell key={entry.key} fill={sliceColor(i)} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className={styles.donutCenter}>
          <span className={styles.donutTotal}>{categoryTotal}</span>
          <span className={styles.donutLabel}>records</span>
        </div>
      </div>
    </div>
  );
}
