import * as React from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { TabLink } from "./TabLink";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AnecdotalCategory,
  type AnecdotalStudent,
  type AnecdotalSummary,
} from "./data";
import { apiClient } from "@/lib/api/client";
import styles from "./anecdotal-panel.module.css";

const EMPTY: AnecdotalSummary = { categories: [], total: 0, students: [] };

export function AnecdotalPanel({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const [summary, setSummary] = React.useState<AnecdotalSummary>(EMPTY);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .get<AnecdotalSummary>("/api/anecdotal/summary")
      .then((res) => {
        if (!cancelled) setSummary(res.data);
      })
      .catch((err: unknown) => {
        console.error("[/api/anecdotal/summary] fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = summary.categories as AnecdotalCategory[];

  const total = summary.total;
  const topCategory = [...categories].sort((a, b) => b.value - a.value)[0]?.label ?? "-";
  const behavioralBullyingPct = total
    ? Math.round(
        ((categories.find((c) => c.key === "behavioral")?.value ?? 0) +
          (categories.find((c) => c.key === "bullying")?.value ?? 0)) /
          total *
          100
      )
    : 0;

  const categoryConfig = categories.reduce<ChartConfig>((acc, c) => {
    acc[c.key] = { label: c.label, color: c.color };
    return acc;
  }, {});

  const students = summary.students as AnecdotalStudent[];

  if (loading) {
    return (
      <div className={styles.anecdotalPanel}>
        <div className={styles.anecdotalTop}>
          <Skeleton className={styles.chartSkeleton} />
          <ul className={styles.donutLegend}>
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className={styles.legendItem}>
                <Skeleton className={styles.legendDot} />
                <Skeleton className={styles.legendLabelSkeleton} />
                <Skeleton className={styles.legendValueSkeleton} />
              </li>
            ))}
          </ul>
          <div className={styles.anecdotalSummary}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.summaryItem}>
                <Skeleton className={styles.summaryValueSkeleton} />
                <Skeleton className={styles.summaryLabelSkeleton} />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.anecdotalTableCard}>
          <h3 className={styles.tableTitle}>Recently Logged Learners</h3>
          <div className={styles.tableScroll}>
            <table className={styles.anecdotalTable}>
              <thead>
                <tr>
                  <th>LRN</th>
                  <th>Section</th>
                  <th>Year</th>
                  <th>Added</th>
                  <th>Adviser</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton className={styles.cellSkeleton} /></td>
                    <td><Skeleton className={styles.cellSkeleton} /></td>
                    <td><Skeleton className={styles.cellSkeleton} /></td>
                    <td><Skeleton className={styles.cellSkeleton} /></td>
                    <td><Skeleton className={styles.cellSkeleton} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Skeleton className={styles.tabLinkSkeleton} />
      </div>
    );
  }

  return (
    <div className={styles.anecdotalPanel}>
      <div className={styles.anecdotalTop}>
        <div className={styles.anecdotalChart}>
          <ChartContainer
            id="anecdotal-categories"
            config={categoryConfig as ChartConfig}
            className={styles.donutWrap}
          >
            <RechartsPieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent nameKey="label" hideLabel />}
              />
              <Pie
                data={categories}
                dataKey="value"
                nameKey="key"
                innerRadius={26}
                outerRadius={42}
                paddingAngle={2}
              >
                {categories.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
            </RechartsPieChart>
          </ChartContainer>
        </div>

        <ul className={styles.donutLegend}>
          {categories.map((c) => (
            <li key={c.key} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              <span className={styles.legendLabel}>{c.label}</span>
              <span className={styles.legendValue}>{c.value}</span>
            </li>
          ))}
        </ul>

        <div className={styles.anecdotalSummary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{total}</span>
            <span className={styles.summaryLabel}>Total Records</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{topCategory}</span>
            <span className={styles.summaryLabel}>Top Category</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{behavioralBullyingPct}%</span>
            <span className={styles.summaryLabel}>Behavioral + Bullying</span>
          </div>
        </div>
      </div>

      <div className={styles.anecdotalTableCard}>
        <h3 className={styles.tableTitle}>Recently Logged Learners</h3>
        <div className={styles.tableScroll}>
          <table className={styles.anecdotalTable}>
            <thead>
              <tr>
                <th>LRN</th>
                <th>Section</th>
                <th>Year</th>
                <th>Added</th>
                <th>Adviser</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td className={styles.mono} colSpan={5}>
                    {loading ? "Loading…" : "No records yet"}
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id}>
                    <td className={styles.mono}>{s.lrn}</td>
                    <td>{s.section}</td>
                    <td>{s.year}</td>
                    <td>{s.dateAdded}</td>
                    <td>{s.adviser}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TabLink href={href} label={label} />
    </div>
  );
}
