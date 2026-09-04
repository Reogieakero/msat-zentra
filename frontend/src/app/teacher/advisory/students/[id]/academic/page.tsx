"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AcademicList } from "./components/AcademicList";
import { fetchStudentAcademic } from "./components/academic-data";
import styles from "./components/academic.module.css";

export default function StudentAcademicPage() {
  const params = useParams<{ id: string }>();
  const studentId = decodeURIComponent(params.id);
  const academicQuery = useQuery({
    queryKey: ["advisee-academic", studentId],
    queryFn: () => fetchStudentAcademic(studentId),
    retry: false,
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
