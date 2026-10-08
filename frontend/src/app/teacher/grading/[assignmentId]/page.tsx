"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { classDetailKey, useClassDetail } from "@/services/teacher/grading.service";
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

  if (detailQuery.isError && !detailQuery.data) {
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

  if (detailQuery.isPending || !detailQuery.data) {
    return <ClassWorkspaceSkeleton />;
  }

  return (
    <>
      <ClassWorkspace detail={detailQuery.data} onMutated={refresh} />
    </>
  );
}
