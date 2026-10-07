"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GuidanceGradeAttentionRow } from "@/services/guidance/overview.types";
import styles from "./guidance-overview-grade-table.module.css";

interface GuidanceOverviewGradeTableProps {
  rows: GuidanceGradeAttentionRow[];
}

function buildInterpretation(rows: GuidanceGradeAttentionRow[]): string {
  const totalAtRisk = rows.reduce((n, row) => n + row.atRisk, 0);
  const totalHigh = rows.reduce((n, row) => n + row.high, 0);

  if (totalAtRisk === 0) {
    return "No students are currently flagged as at-risk in any grade level this term.";
  }

  const top = [...rows].sort((a, b) => b.atRisk - a.atRisk)[0];
  const hotspot =
    top.topSection !== "—" && top.topCount > 0
      ? `, concentrated in ${top.topSection} with ${top.topCount} students`
      : "";

  return (
    `${totalAtRisk} are flagged at-risk, including ${totalHigh} high-risk. ` +
    `${top.grade} needs the most attention with ${top.atRisk} flagged students${hotspot}.`
  );
}

function mostLevelBadge(level: GuidanceGradeAttentionRow["mostLevel"]) {
  if (level === "High") return <Badge variant="red">High</Badge>;
  if (level === "Moderate") return <Badge variant="amber">Moderate</Badge>;
  if (level === "Low") return <Badge variant="green">Low</Badge>;
  return <span className={styles.muted}>—</span>;
}

/**
 * Grade levels needing attention — one row per grade level with every
 * section of that level in the row, the at-risk headcount, and the most
 * common risk level among the grade's at-risk students. Searchable, with
 * row-click into Interventions. Terminal-free by construction: grades
 * always list, counts plainly show zero.
 */
export function GuidanceOverviewGradeTable({ rows }: GuidanceOverviewGradeTableProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.grade} ${r.short} ${r.sectionsList.map((s) => s.name).join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const searching = query.trim() !== "";

  return (
    <Card className={styles.card}>
      <span className={styles.glowClip} aria-hidden="true">
        <span className={styles.cardGlow} />
      </span>
      <CardHeader>
        <div className={styles.headerRow}>
          <div>
            <CardTitle className={styles.sectionTitle}>Grade levels needing attention</CardTitle>
            <CardDescription className={styles.sectionDesc}>
              Live ranking — most at-risk students per grade this term.
            </CardDescription>
          </div>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              style={{ height: "2rem" }}
              placeholder="Search grade or section…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search grade levels"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {searching ? "No grades match your search" : "No grades to show"}
            </p>
            <p className={styles.emptyHint}>
              {searching
                ? "Try a different grade or section name."
                : "Grade attention will appear here once students enroll."}
            </p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <Table aria-label="Grade levels needing attention">
              <TableHeader>
                <TableRow>
                  <TableHead>Grade level</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>At-risk students</TableHead>
                  <TableHead>Most level risk</TableHead>
                  <TableHead>
                    <span className={styles.srOnly}>Row actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow
                    key={row.short}
                    className={styles.clickableRow}
                    tabIndex={0}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button,a")) return;
                      router.push("/guidance/interventions");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push("/guidance/interventions");
                      }
                    }}
                  >
                    <TableCell>
                      <p className={styles.cellMain}>{row.grade}</p>
                      <p className={styles.cellSub}>
                        {row.sections} section{row.sections === 1 ? "" : "s"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className={styles.sectionChips}>
                        {row.sectionsList.map((s) => (
                          <span key={s.name} className={styles.sectionChip}>
                            {s.name}
                            <span className={styles.sectionCount}>{s.atRisk}</span>
                          </span>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={styles.atRiskCount}>{row.atRisk}</span>
                    </TableCell>
                    <TableCell>{mostLevelBadge(row.mostLevel)}</TableCell>
                    <TableCell>
                      <Button asChild size="xs" variant="outline" aria-label={`See ${row.grade} in Interventions`}>
                        <Link href="/guidance/interventions">See more</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className={styles.interpretation}>
          <span className={styles.interpretationLabel}>What it means · </span>
          {buildInterpretation(rows)}
        </p>
      </CardContent>
    </Card>
  );
}
