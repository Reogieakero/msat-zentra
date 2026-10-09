"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { StudentsAcademicsGrid } from "./components/StudentsAcademicsGrid";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import styles from "./page.module.css";

export default function PrincipalAcademicsPage() {
  const { activeTerm, termReady } = useTerm();
  const termId = activeTerm?.termId ?? null;
  const schoolYearId = activeTerm?.schoolYearId ?? null;
  const { data, isPending, isError } = useQuery({
    queryKey: ["academics", termId, schoolYearId],
    queryFn: async () => (await apiClient.get<{ sections?: unknown[] }>("/api/academics")).data,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    enabled: termReady,
  });
  const isEmpty = !isPending && !isError && (data?.sections ?? []).length === 0;
  const headerLoading = isPending || !termReady;
  return (
    <section className={styles.page} aria-busy={headerLoading || undefined}>
      {headerLoading ? (
        <PageHeaderSkeleton />
      ) : isEmpty ? null : (
      <PrincipalPageHeader
        title="Academic Performance"
        description="A school-wide view of grading, honor roll, and at-risk performance across every grade level and section."
      />
      )}
      <StudentsAcademicsGrid />
    </section>
  );
}
