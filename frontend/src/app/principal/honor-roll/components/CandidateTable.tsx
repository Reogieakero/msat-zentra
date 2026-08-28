"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { HonorRollCandidate } from "../honor-roll-data";
import shared from "../honor-roll.module.css";
import styles from "./CandidateTable.module.css";

interface Props {
  candidates: HonorRollCandidate[];
  grades: number[];
  activeGrade: string;
  onGradeChange: (grade: string) => void;
  loading?: boolean;
}

export function CandidateTable({
  candidates,
  grades,
  activeGrade,
  onGradeChange,
  loading,
}: Props) {
  // Build a stable column set from the union of subject codes present.
  const columns = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of candidates) {
      for (const s of c.subjects) {
        if (!seen.has(s.code)) seen.set(s.code, s.subject);
      }
    }
    return Array.from(seen, ([code, subject]) => ({ code, subject }));
  }, [candidates]);

  const rows = React.useMemo(
    () => [...candidates].sort((a, b) => b.overallAverage - a.overallAverage),
    [candidates]
  );

  const windowTitle = `Grade ${activeGrade} — Honor Roll`;

  const body = loading ? (
    <div className={shared.tableWrap}>
      <div className={styles.skeletonHead} />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className={styles.skeletonRow} />
      ))}
    </div>
  ) : rows.length === 0 ? (
    <div className={styles.emptyState}>No candidates this term.</div>
  ) : (
    <div className={shared.tableWrap}>
      <table className={styles.table}>
        <thead className={shared.stickyHead}>
          <tr>
            <th className={styles.nameCol}>Student</th>
            <th>Section</th>
            <th className={styles.numCol}>Term Avg</th>
            {columns.map((col) => (
              <th key={col.code} className={styles.subjCol} title={col.subject}>
                {col.code}
              </th>
            ))}
            <th>Tier</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const gradeByCode = new Map(c.subjects.map((s) => [s.code, s]));
            return (
              <tr key={c.studentId} className={styles.row}>
                <td className={styles.nameCol}>
                  <span className={styles.name}>{c.name}</span>
                  <span className={shared.mono}>{c.lrn}</span>
                </td>
                <td className={styles.muted}>{c.section}</td>
                <td className={`${styles.numCol} ${shared.mono}`}>
                  {c.overallAverage.toFixed(1)}
                </td>
                {columns.map((col) => {
                  const g = gradeByCode.get(col.code);
                  if (!g) return <td key={col.code} className={styles.subjCol} />;
                  const failing = g.transmutedGrade < 85;
                  return (
                    <td
                      key={col.code}
                      className={`${styles.subjCol} ${shared.mono} ${
                        failing ? styles.fail : ""
                      }`}
                      title={`${col.subject}: ${g.transmutedGrade}`}
                    >
                      {g.transmutedGrade}
                    </td>
                  );
                })}
                <td>
                  <Badge variant="secondary" className={styles.tierBadge}>
                    {c.tier}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <Card>
      <div className={styles.head}>
        <h2 className={styles.headTitle}>{windowTitle}</h2>
        <div className={styles.tabs} role="tablist" aria-label="Grade level">
          {grades.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={String(g) === activeGrade}
              className={`${styles.tab} ${
                String(g) === activeGrade ? styles.tabActive : ""
              }`}
              onClick={() => onGradeChange(String(g))}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {body}
    </Card>
  );
}
