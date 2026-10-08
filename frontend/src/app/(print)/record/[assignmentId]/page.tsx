"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  COMPONENT_ORDER,
  computeSubjectGrade,
  gradeLabel,
  subjectEvidence,
} from "@/services/teacher/grading.compute";
import { fetchClassDetail } from "@/services/teacher/grading.service";
import styles from "./record-sheet.module.css";

const SHORT: Record<string, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  EXAM: "E",
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
  const gradeByStudent = new Map(
    students.map((s) => [s.id, computeSubjectGrade(subjectEvidence(components, s.id))]),
  );

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
          <>
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
                        {n === 0 ? " — No assessments (excluded)" : ""}
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
                    E avg
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
                  const grade = gradeByStudent.get(s.id);
                  const avgOf = (t: string) => {
                    const pct = grade?.categories.find((c) => c.componentType === t)?.percentage;
                    return pct == null ? null : pct;
                  };

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
                      <td className={styles.avgCol}>{avgOf("WRITTEN_WORK")?.toFixed(1) ?? "N/A"}</td>
                      <td className={styles.avgCol}>{avgOf("PERFORMANCE_TASK")?.toFixed(1) ?? "N/A"}</td>
                      <td className={styles.avgCol}>{avgOf("EXAM")?.toFixed(1) ?? "N/A"}</td>
                      <td className={styles.finalCol}>
                        {grade?.computedAverage != null ? grade.computedAverage.toFixed(2) : "—"}
                      </td>
                      <td className={styles.finalCol}>
                        {grade?.transmutedGrade != null ? grade.transmutedGrade.toFixed(0) : "—"}
                      </td>
                      <td className={styles.finalCol}>{grade?.remarks ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.footnote}>
            Category averages use total-earned ÷ total-possible over encoded scores only.
            Categories with no assessments are excluded (N/A) and the remaining
            weights normalize to 100. Unencoded scores are not zeroes. Computed,
            Transmuted, and Remarks are calculated live from recorded assessments.
          </p>
          </>
        )}
      </div>
    </section>
  );
}
