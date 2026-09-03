"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRecordKeeperOverview, type RecordKeeperGradeCountRow } from "./overview-data";
import styles from "./OverviewHeader.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
  boxShadow: "0 4px 12px -6px rgb(0 0 0 / 0.25)",
};

const BAR_COLOR = "#2563eb";
const BAR_ALT_COLOR = "#38bdf8";

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface GroupedGradeRow {
  grade: string;
  subjects: number;
  sections: number;
}

interface KpiCardProps {
  title: string;
  total?: number;
  children: React.ReactNode;
}

function KpiCard({ title, total, children }: KpiCardProps) {
  return (
    <article className={styles.kpiCard}>
      <div className={styles.kpiHeader}>
        <h2 className={styles.kpiTitle}>{title}</h2>
        {total !== undefined && <span className={styles.kpiTotal}>{total}</span>}
      </div>
      {children}
    </article>
  );
}

function DonutChart({ slices, total }: { slices: Slice[]; total: number }) {
  if (total === 0) {
    return <p className={styles.chartEmpty}>No records on file.</p>;
  }
  return (
    <>
      <div className={styles.donutWrap}>
        <ResponsiveContainer width="100%" height={128}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={58}
              paddingAngle={2}
              strokeWidth={0}
            >
              {slices.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.donutCenter}>
          <span className={styles.donutValue}>{total}</span>
          <span className={styles.donutCaption}>total</span>
        </div>
      </div>
      <ul className={styles.legend}>
        {slices.map((s) => (
          <li key={s.label} className={styles.legendItem}>
            <span className={styles.legendLabel}>
              <span className={styles.legendDot} style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
            </span>
            <span className={styles.legendCount}>{s.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function GroupedGradeBars({ rows }: { rows: GroupedGradeRow[] }) {
  if (rows.length === 0) {
    return <p className={styles.chartEmpty}>No data for the grade band.</p>;
  }
  return (
    <div className={styles.barWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis
            dataKey="grade"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklch, var(--foreground), transparent 95%)" }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Bar dataKey="subjects" name="Subjects" radius={[4, 4, 0, 0]} fill={BAR_COLOR} maxBarSize={26} />
          <Bar dataKey="sections" name="Sections" radius={[4, 4, 0, 0]} fill={BAR_ALT_COLOR} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function interpretFinalGradeApproval(
  finalized: number,
  awaiting: number,
  total: number
): string {
  if (total === 0) return "No report-card entries are on record for the G7–10 band yet.";
  let text = `${finalized} of ${total} report-card entries finalized`;
  if (awaiting > 0) text += `, ${awaiting} waiting on your final approval`;
  return text + ".";
}

function interpretSf10(released: number, available: number, total: number): string {
  if (total === 0) return "No SF10 records are on file for the G7–10 band yet.";
  let text = `${released} of ${total} SF10 records released`;
  if (available > 0) text += `, ${available} on hand`;
  return text + ".";
}

function interpretGradeCounts(rows: RecordKeeperGradeCountRow[], noun: string): string {
  if (rows.length === 0 || rows.every((r) => r.count === 0)) {
    return `No ${noun.toLowerCase()} registered for the G7–10 band this term.`;
  }
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const parts = rows.map((r) => `${r.grade}: ${r.count}`).join(", ");
  return `${noun} split ${parts} — ${total} in total across the grade band.`;
}

function SkeletonCard() {
  return (
    <div className={styles.kpiCard}>
      <Skeleton className={styles.skelHeader} />
      <Skeleton className={styles.skelChart} />
    </div>
  );
}

export function OverviewHeader() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["record-keeper-overview"],
    queryFn: fetchRecordKeeperOverview,
  });

  const finals = data?.finals;
  const sf10 = data?.sf10;
  const subjects = data?.subjectsByGrade ?? [];
  const sections = data?.sectionsByGrade ?? [];

  const grades = new Set([...subjects.map((r) => r.grade), ...sections.map((r) => r.grade)]);
  const bandRows: GroupedGradeRow[] = [...grades].map((grade) => ({
    grade,
    subjects: subjects.find((r) => r.grade === grade)?.count ?? 0,
    sections: sections.find((r) => r.grade === grade)?.count ?? 0,
  }));

  const finalsSlices: Slice[] = finals
    ? [
        { label: "Finalized", value: finals.finalized, color: "#2563eb" },
        { label: "Awaiting approval", value: finals.awaiting, color: "#f59e0b" },
        { label: "In draft", value: finals.draft, color: "#cbd5e1" },
      ]
    : [];

  const sf10Slices: Slice[] = sf10
    ? [
        { label: "Released", value: sf10.released, color: "#16a34a" },
        { label: "Available", value: sf10.available, color: "#2563eb" },
        { label: "Attach", value: sf10.attach, color: "#cbd5e1" },
      ]
    : [];

  return (
    <div className={styles.header}>
      {isPending ? (
        <div className={styles.kpiGrid}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : isError ? (
        <p className={styles.chartEmpty}>Could not load the overview figures.</p>
      ) : (
        <div className={styles.kpiGrid}>
          <KpiCard title="Report Cards" total={finals?.total ?? 0}>
            <DonutChart slices={finalsSlices} total={finals?.total ?? 0} />
            <p className={styles.chartInterpretation}>
              {interpretFinalGradeApproval(
                finals?.finalized ?? 0,
                finals?.awaiting ?? 0,
                finals?.total ?? 0
              )}
            </p>
          </KpiCard>

          <KpiCard title="SF10 Records" total={sf10?.total ?? 0}>
            <DonutChart slices={sf10Slices} total={sf10?.total ?? 0} />
            <p className={styles.chartInterpretation}>
              {interpretSf10(sf10?.released ?? 0, sf10?.available ?? 0, sf10?.total ?? 0)}
            </p>
          </KpiCard>

          <KpiCard
            title="Subjects & Sections by Grade"
            total={sections.reduce((s, r) => s + r.count, 0)}
          >
            <GroupedGradeBars rows={bandRows} />
            <ul className={styles.legend}>
              <li className={styles.legendItem}>
                <span className={styles.legendLabel}>
                  <span className={styles.legendDot} style={{ backgroundColor: BAR_COLOR }} aria-hidden />
                  Subjects
                </span>
                <span className={styles.legendCount}>{subjects.reduce((s, r) => s + r.count, 0)}</span>
              </li>
              <li className={styles.legendItem}>
                <span className={styles.legendLabel}>
                  <span className={styles.legendDot} style={{ backgroundColor: BAR_ALT_COLOR }} aria-hidden />
                  Sections
                </span>
                <span className={styles.legendCount}>{sections.reduce((s, r) => s + r.count, 0)}</span>
              </li>
            </ul>
            <p className={styles.chartInterpretation}>
              {interpretGradeCounts(subjects, "Subjects")} {interpretGradeCounts(sections, "Sections")}
            </p>
          </KpiCard>
        </div>
      )}
    </div>
  );
}