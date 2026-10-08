"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AcademicList } from "./components/AcademicList";
import { fetchStudentAcademic } from "@/services/teacher/adviseeAcademic.service";
import type { StudentAcademic } from "@/services/teacher/adviseeAcademic.types";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/academic.module.css";

export default function StudentAcademicPage() {
  const params = useParams<{ id: string }>();
  const studentId = decodeURIComponent(params.id);
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const academicQuery = useQuery<StudentAcademic>({
    queryKey: ["advisee-academic", studentId, termKey],
    queryFn: () => fetchStudentAcademic(studentId),
    placeholderData: keepPreviousData,
    retry: false,

    staleTime: 0,
    refetchOnMount: "always",
  });
  const student = academicQuery.data?.student ?? null;

  return (
    <section className={styles.page}>
      <Link href="/teacher/advisory/students" className={styles.backLink}>
        <ChevronLeft aria-hidden />
        Advisees
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>
          {academicQuery.isPending ? "Academic record" : (student?.name ?? "Academic record")}
        </h1>
        <p className={styles.subtitle}>
          {student ? `${student.lrn} · ${student.section}` : "Subject grades for this term, read-only."}
        </p>
      </div>
      <hr className={styles.divider} />

      <div className={styles.body}>
        {academicQuery.isError ? (
          <p className={styles.error}>
            These records are unavailable — the student may not be in your advisory.
          </p>
        ) : (
          <AcademicList
            grades={academicQuery.data?.grades ?? []}
            summary={academicQuery.data?.summary ?? null}
            loading={academicQuery.isPending}
          />
        )}
      </div>
    </section>
  );
}
