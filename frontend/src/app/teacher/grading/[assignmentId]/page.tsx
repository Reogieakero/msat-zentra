"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { classDetailKey, useClassDetail } from "@/services/teacher/grading.service";
import { useTeacherOverviewGradebook } from "@/services/teacher/overview.service";
import { useSession } from "@/lib/auth/useSession";
import { gradebookSlug } from "@/lib/gradebookSlug";
import { ClassWorkspace } from "./components/ClassWorkspace";
import { ClassWorkspaceSkeleton } from "./components/ClassWorkspaceSkeleton";
import styles from "./components/ClassWorkspace.module.css";

function decodeParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function ClassWorkspacePage() {
  const params = useParams<{ assignmentId: string }>();
  const param = decodeParam(params.assignmentId);
  const queryClient = useQueryClient();
  const session = useSession();

  // URLs carry a subject+section slug; resolve it to the internal
  // `${subjectId}|${sectionId}` class id via the overview class list.
  // Legacy id URLs (still accepted by the API) keep working.
  const gradebook = useTeacherOverviewGradebook();
  const classes = gradebook.data?.classes ?? [];
  const match = classes.find((c) => c.id === param || gradebookSlug(c) === param);
  const legacyId = param.includes("|") ? param : "";
  const assignmentId = match?.id ?? legacyId;

  const detailQuery = useClassDetail(assignmentId);

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: classDetailKey(session?.sub ?? null, assignmentId),
    });

  if ((detailQuery.isError && !detailQuery.data) || (!assignmentId && gradebook.isFetched)) {
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

  if (!assignmentId || detailQuery.isPending || !detailQuery.data) {
    return <ClassWorkspaceSkeleton />;
  }

  return (
    <>
      <ClassWorkspace detail={detailQuery.data} queryKeyId={assignmentId} onMutated={refresh} />
    </>
  );
}
