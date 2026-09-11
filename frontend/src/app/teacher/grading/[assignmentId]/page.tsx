"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchClassDetail } from "../components/grading-data";
import { ClassWorkspace } from "./components/ClassWorkspace";
import styles from "./components/ClassWorkspace.module.css";

export default function ClassWorkspacePage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["teacher-grading-class", assignmentId],
    queryFn: () => fetchClassDetail(assignmentId),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["teacher-grading-class", assignmentId] });

  if (detailQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading class workspace">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <section className={styles.page}>
        <Link href="/teacher/grading" className={styles.back}>
          <ArrowLeft className={styles.backIcon} />
          Back to Gradebook
        </Link>
        <p>Class not found or you have no access to it.</p>
      </section>
    );
  }

  // No remount key here on purpose: the encoder keeps its category,
  // assessment, and draft state across refetches, so saved scores stay on
  // screen and remain editable. Fresh server data flows in via props
  // (finals table, assessment lists) while drafts are preserved.
  return (
    <ClassWorkspace detail={detailQuery.data} onMutated={refresh} />
  );
}
