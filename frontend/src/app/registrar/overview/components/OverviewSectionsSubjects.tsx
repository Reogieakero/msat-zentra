"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchRegistrarOverview } from "./overview-data";
import styles from "./OverviewSectionsSubjects.module.css";

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
  boxShadow: "0 4px 12px -6px rgb(0 0 0 / 0.25)",
};

const SUBJECTS_COLOR = "var(--primary)";
const SECTIONS_COLOR = "var(--muted-foreground)";

interface BandRow {
  grade: string;
  subjects: number;
  sections: number;
}

export function OverviewSectionsSubjects() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["registrar-overview"],
    queryFn: fetchRegistrarOverview,
  });

  const rows: BandRow[] = React.useMemo(() => {
    const subjects = data?.subjectsByGrade ?? [];
    const sections = data?.sectionsByGrade ?? [];
    const grades = new Set([
      ...subjects.map((r) => r.grade),
      ...sections.map((r) => r.grade),
    ]);
    return [...grades]
      .map((grade) => ({
        grade,
        subjects: subjects.find((r) => r.grade === grade)?.count ?? 0,
        sections: sections.find((r) => r.grade === grade)?.count ?? 0,
      }))
      .sort((a, b) => a.grade.localeCompare(b.grade));
  }, [data]);

  const totals = React.useMemo(() => {
    return {
      subjects: rows.reduce((s, r) => s + r.subjects, 0),
      sections: rows.reduce((s, r) => s + r.sections, 0),
    };
  }, [rows]);

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerText}>
          <CardTitle>Sections & Subjects</CardTitle>
          <CardDescription>
            Active structure counts per grade for the band.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className={styles.content}>
        {isPending ? (
          <Skeleton className={styles.skel} />
        ) : isError ? (
          <p className={styles.empty}>Could not load structure counts.</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>No sections or subjects on record.</p>
        ) : (
          <>
            <div className={styles.barWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rows}
                  margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
                >
                  <XAxis
                    dataKey="grade"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{
                      fill: "color-mix(in oklch, var(--foreground), transparent 95%)",
                    }}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar
                    dataKey="subjects"
                    name="Subjects"
                    radius={[4, 4, 0, 0]}
                    fill={SUBJECTS_COLOR}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="sections"
                    name="Sections"
                    radius={[4, 4, 0, 0]}
                    fill={SECTIONS_COLOR}
                    maxBarSize={26}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className={styles.legend}>
              <li className={styles.legendItem}>
                <span
                  className={styles.dot}
                  style={{ backgroundColor: SUBJECTS_COLOR }}
                  aria-hidden
                />
                <span className={styles.legendLabel}>Subjects</span>
                <span className={styles.legendCount}>{totals.subjects}</span>
              </li>
              <li className={styles.legendItem}>
                <span
                  className={styles.dot}
                  style={{ backgroundColor: SECTIONS_COLOR }}
                  aria-hidden
                />
                <span className={styles.legendLabel}>Sections</span>
                <span className={styles.legendCount}>{totals.sections}</span>
              </li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
