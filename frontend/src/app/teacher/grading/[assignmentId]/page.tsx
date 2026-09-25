"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { classDetailKey, useClassDetail } from "../components/grading-data";
import { useSession } from "@/lib/auth/useSession";
import { ClassWorkspace } from "./components/ClassWorkspace";
import { ClassWorkspaceSkeleton } from "./components/ClassWorkspaceSkeleton";
import styles from "./components/ClassWorkspace.module.css";

export default function ClassWorkspacePage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const queryClient = useQueryClient();
  const session = useSession();
  const detailQuery = useClassDetail(assignmentId);

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: classDetailKey(session?.sub ?? null, assignmentId),
    });

  // Initial load only: mirrors the workspace (back link, header, sidebar,
  // encode table with Student/LRN/Score/% columns, footer). Background
  // refetches keep existing data visible via placeholderData above.
  if (detailQuery.isPending || !detailQuery.data) {
    return <ClassWorkspaceSkeleton />;
  }

  if (detailQuery.isError) {
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
    <>
      {detailQuery.isFetching ? (
        <p className={styles.skelSync} role="status" aria-live="polite">
          Updating scores…
        </p>
      ) : null}
      <ClassWorkspace detail={detailQuery.data} onMutated={refresh} />
    </>
  );
}
