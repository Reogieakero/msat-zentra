"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MyAnecdotalRecord } from "@/components/ocform01/folders";
import styles from "./anecdotal-repo-sidebar.module.css";

const CATEGORY_META: { key: string; label: string; color: string }[] = [
  { key: "behavioral", label: "Behavioral", color: "var(--chart-1)" },
  { key: "bullying", label: "Bullying", color: "var(--chart-2)" },
  { key: "academic", label: "Academic", color: "var(--chart-3)" },
  { key: "attendance", label: "Attendance", color: "var(--chart-4)" },
  { key: "health", label: "Health", color: "var(--chart-5)" },
];

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
};

export function AnecdotalRepoSidebar({ records }: { records: MyAnecdotalRecord[] }) {
  const total = records.length;
  const byCategory = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    return CATEGORY_META.map((c) => ({ ...c, count: counts.get(c.key) ?? 0 }));
  }, [records]);
  const tiers = React.useMemo(() => {
    let restricted = 0;
    let confidential = 0;
    for (const r of records) {
      if (r.confidentialityLevel === "confidential") confidential += 1;
      else restricted += 1;
    }
    return [
      { key: "restricted", label: "Restricted", count: restricted },
      { key: "confidential", label: "Confidential", count: confidential },
    ];
  }, [records]);
  const top = [...byCategory].sort((a, b) => b.count - a.count)[0];

  return (
    <>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Filed records by category</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            Every anecdotal record you filed — live counts.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.body}>
          {total === 0 ? (
            <p className={styles.empty}>No filed records yet.</p>
          ) : (
            <>
              <div className={styles.donut}>
                <ResponsiveContainer width="100%" height={168}>
                  <PieChart>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Pie
                      data={byCategory}
                      dataKey="count"
                      nameKey="label"
                      innerRadius="65%"
                      outerRadius="90%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {byCategory.map((row) => (
                        <Cell key={row.key} fill={row.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <p className={styles.donutTotal}>
                  <span className={styles.donutNumber}>{total}</span>
                  <span className={styles.donutCaption}>filed</span>
                </p>
              </div>
              <ul className={styles.legend}>
                {byCategory.map((row) => (
                  <li key={row.key} className={styles.legendRow}>
                    <span className={styles.legendLabel}>
                      <span className={styles.legendDot} style={{ backgroundColor: row.color }} aria-hidden />
                      {row.label}
                    </span>
                    <span className={styles.legendCount}>{row.count}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.interpretation}>
                {total} filed record{total === 1 ? "" : "s"}
                {top && top.count > 0 ? ` — most filed as ${top.label.toLowerCase()} (${top.count})` : ""}.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.sectionTitle}>Confidentiality</CardTitle>
          <CardDescription className={styles.sectionDesc}>
            How your filed records are marked.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.body}>
          {total === 0 ? (
            <p className={styles.empty}>Nothing to break down yet.</p>
          ) : (
            <ul className={styles.bars}>
              {tiers.map((t) => (
                <li key={t.key} className={styles.barRow}>
                  <span className={styles.barLabel}>{t.label}</span>
                  <span className={styles.barTrack} aria-hidden>
                    <span
                      className={styles.barFill}
                      style={{ width: `${total === 0 ? 0 : Math.round((t.count / total) * 100)}%` }}
                    />
                  </span>
                  <span className={styles.barCount}>{t.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.tierNote}>
            Confidential records are handled with extra care — only the roles involved in the case can open them.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
