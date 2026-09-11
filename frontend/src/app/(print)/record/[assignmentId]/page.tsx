"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  COMPONENT_ORDER,
  categoryWork,
  fetchClassDetail,
  gradeLabel,
} from "@/app/teacher/grading/components/grading-data";
import styles from "./record-sheet.module.css";

const SHORT: Record<string, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  QUARTERLY_EXAM: "QE",
};

export default function ClassRecordPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const detailQuery = useQuery({
    queryKey: ["teacher-grading-class", assignmentId],
    queryFn: () => fetchClassDetail(assignmentId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (detailQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading class record">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-96 w-full" />
      </section>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className={styles.page}>
        <div className={styles.toolbar}>
          <Link href={`/teacher/grading/${assignmentId}`} className={styles.back}>
            <ArrowLeft className={styles.backIcon} />
            Back to workspace
          </Link>
        </div>
        <p className={styles.error}>Class record not found or you have no access to it.</p>
      </section>
    );
  }

  const { assignment, students, components } = detailQuery.data;
  const workByStudent = new Map(students.map((s) => [s.id, categoryWork(components, s.id)]));

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <Link href={`/teacher/grading/${assignmentId}`} className={styles.back}>
          <ArrowLeft className={styles.backIcon} />
          Back to workspace
        </Link>
        <span className={styles.toolbarSpacer} />
        <Button variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden />
          Print
        </Button>
      </div>

      <div className={styles.sheet}>
        <div className={styles.sheetHead}>
          <p className={styles.school}>Class Record — Grading Sheet</p>
          <h1 className={styles.title}>
            {assignment.subjectName} ({assignment.subjectCode})
          </h1>
          <p className={styles.meta}>
            {assignment.sectionName} · Grade {gradeLabel(assignment.gradeLevel)} · Term{" "}
            {assignment.termNumber} · {assignment.schoolYear} · {students.length} student
            {students.length === 1 ? "" : "s"}
          </p>
        </div>

        {students.length === 0 ? (
          <p className={styles.empty}>No students in this section yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyCol} rowSpan={2}>
                    Student
                  </th>
                  {COMPONENT_ORDER.map((t) => {
                    const c = components.find((x) => x.type === t);
                    const n = c?.assessments.length ?? 0;
                    return (
                      <th key={t} colSpan={Math.max(n, 1)} className={styles.groupHead}>
                        {SHORT[t]} · {c ? `${c.weight}%` : "—"}
                      </th>
                    );
                  })}
                  <th rowSpan={2} className={styles.avgCol}>
                    WW avg
                  </th>
                  <th rowSpan={2} className={styles.avgCol}>
                    PT avg
                  </th>
                  <th rowSpan={2} className={styles.avgCol}>
                    QE avg
                  </th>
                  <th rowSpan={2}>Computed</th>
                  <th rowSpan={2}>Transmuted</th>
                  <th rowSpan={2}>Remarks</th>
                </tr>
                <tr>
                  {COMPONENT_ORDER.map((t) => {
                    const list =
                      components.find((x) => x.type === t)?.assessments ?? [];
                    if (list.length === 0) return <th key={t}>—</th>;
                    return list.map((a) => <th key={a.id}>{a.title}</th>);
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const work = workByStudent.get(s.id) ?? [];
                  const avgOf = (t: string) => work.find((w) => w.type === t)?.average ?? 0;
                  const f = s.final;
                  return (
                    <tr key={s.id}>
                      <th className={styles.stickyCol} scope="row">
                        {s.name}
                        <span className={styles.cellSub}>{s.lrn}</span>
                      </th>
                      {COMPONENT_ORDER.map((t) => {
                        const list =
                          components.find((x) => x.type === t)?.assessments ?? [];
                        if (list.length === 0) return <td key={t}>—</td>;
                        return list.map((a) => {
                          const raw = a.scores[s.id];
                          return (
                            <td key={a.id}>
                              {raw != null ? (
                                <>
                                  {raw}
                                  <span className={styles.cellSub}>
                                    {a.maxScore > 0 ? `${((raw / a.maxScore) * 100).toFixed(1)}%` : "—"}
                                  </span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        });
                      })}
                      <td className={styles.avgCol}>{avgOf("WRITTEN_WORK").toFixed(1)}</td>
                      <td className={styles.avgCol}>{avgOf("PERFORMANCE_TASK").toFixed(1)}</td>
                      <td className={styles.avgCol}>{avgOf("QUARTERLY_EXAM").toFixed(1)}</td>
                      <td className={styles.finalCol}>
                        {f?.computedAverage != null ? f.computedAverage.toFixed(2) : "—"}
                      </td>
                      <td className={styles.finalCol}>
                        {f?.transmutedGrade != null ? f.transmutedGrade.toFixed(0) : "—"}
                      </td>
                      <td className={styles.finalCol}>{f?.remarks ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
