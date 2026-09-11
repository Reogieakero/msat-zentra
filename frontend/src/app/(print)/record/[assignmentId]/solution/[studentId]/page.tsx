"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchClassDetail } from "@/app/teacher/grading/components/grading-data";
import { SolutionContent } from "@/app/teacher/grading/[assignmentId]/components/SolutionContent";
import styles from "../../record-sheet.module.css";

export default function SolutionPrintPage() {
  const params = useParams<{ assignmentId: string; studentId: string }>();
  const assignmentId = params.assignmentId;
  const studentId = decodeURIComponent(params.studentId);
  const detailQuery = useQuery({
    queryKey: ["teacher-grading-class", assignmentId],
    queryFn: () => fetchClassDetail(assignmentId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (detailQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading solution">
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
        <p className={styles.error}>Solution not found or you have no access to it.</p>
      </section>
    );
  }

  const { assignment, students } = detailQuery.data;
  const student = students.find((s) => s.id === studentId);

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
          <p className={styles.school}>Grade solution — DepEd Order No. 8</p>
          <h1 className={styles.title}>
            How the grade is solved{student ? ` — ${student.name}` : ""}
          </h1>
          <p className={styles.meta}>
            {assignment.subjectName} ({assignment.subjectCode}) · {assignment.sectionName} · Term{" "}
            {assignment.termNumber}
            {student ? ` · ${student.lrn}` : ""}
          </p>
        </div>

        <div style={{ padding: "1.25rem" }}>
          <SolutionContent detail={detailQuery.data} studentId={studentId} />
        </div>
      </div>
    </section>
  );
}
