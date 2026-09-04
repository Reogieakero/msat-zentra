"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  VERSION_LABELS,
  humanize,
  type AcademicGrade,
  type AcademicSummary,
  type GradeVersion,
} from "./academic-data";
import { AcademicInsights } from "./AcademicInsights";
import styles from "./AcademicList.module.css";

interface AcademicListProps {
  grades: AcademicGrade[];
  summary: AcademicSummary | null;
  loading: boolean;
}

export function AcademicList({ grades, summary, loading }: AcademicListProps) {
  const [version, setVersion] = useState<GradeVersion>("final");

  if (loading || !summary) {
    return (
      <div className={styles.list} aria-busy="true" aria-label="Loading grades">
        <AcademicInsights grades={[]} summary={null} version={version} loading />
        <div className={styles.tableCard}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skelRow} aria-hidden>
              <Skeleton className={styles.skelSubject} />
              <Skeleton className={styles.skelScore} />
              <Skeleton className={styles.skelPill} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      <div className={styles.versionToggle} role="group" aria-label="Grade version">
        {(Object.keys(VERSION_LABELS) as GradeVersion[]).map((v) => (
          <Button
            key={v}
            type="button"
            size="sm"
            variant={version === v ? "default" : "ghost"}
            onClick={() => setVersion(v)}
          >
            {VERSION_LABELS[v]}
          </Button>
        ))}
      </div>
      <AcademicInsights grades={grades} summary={summary} version={version} loading={false} />

      {grades.length === 0 ? (
        <p className={styles.empty}>No grades encoded this term.</p>
      ) : (
        <div className={styles.tableCard}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Average</TableHead>
                <TableHead>Transmuted</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) => (
                <TableRow
                  key={g.subject}
                  className={g.remarks === "Failed" ? styles.rowFail : undefined}
                >
                  <TableCell className={styles.subject}>{g.subject}</TableCell>
                  <TableCell className={styles.score}>
                    {g.computedAverage === null ? "—" : g.computedAverage.toFixed(1)}
                  </TableCell>
                  <TableCell className={styles.score}>
                    {g.transmutedGrade === null ? "—" : g.transmutedGrade.toFixed(0)}
                  </TableCell>
                  <TableCell>
                    {g.remarks ? (
                      <Badge variant={g.remarks === "Passed" ? "success" : "destructive"}>
                        {g.remarks}
                      </Badge>
                    ) : (
                      <span className={styles.dim}>—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {g.lockStatus ? (
                      <Badge variant="outline">{humanize(g.lockStatus)}</Badge>
                    ) : (
                      <span className={styles.dim}>Not encoded</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
