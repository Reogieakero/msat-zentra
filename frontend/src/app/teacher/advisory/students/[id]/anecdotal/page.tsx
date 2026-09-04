"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AnecdotalList } from "./components/AnecdotalList";
import { fetchStudentAnecdotal } from "./components/anecdotal-data";
import styles from "./components/anecdotal.module.css";

export default function StudentAnecdotalPage() {
  const params = useParams<{ id: string }>();
  const studentId = decodeURIComponent(params.id);
  const anecdotalQuery = useQuery({
    queryKey: ["advisee-anecdotal", studentId],
    queryFn: () => fetchStudentAnecdotal(studentId),
    retry: false,
  });
  const student = anecdotalQuery.data?.student ?? null;
  const records = anecdotalQuery.data?.records ?? [];

  return (
    <section className={styles.page}>
      <Link href="/teacher/advisory/students" className={styles.backLink}>
        <ChevronLeft aria-hidden />
        Advisees
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>
          {anecdotalQuery.isPending ? "Anecdotal records" : (student?.name ?? "Anecdotal records")}
        </h1>
        <p className={styles.subtitle}>
          {student ? `${student.lrn} · ${student.section}` : "Behavior and incident reports for this term."}
        </p>
      </div>
      <hr className={styles.divider} />

      <div className={styles.body}>
        {anecdotalQuery.isError ? (
          <p className={styles.error}>
            These records are unavailable — the student may not be in your advisory.
          </p>
        ) : (
          <AnecdotalList records={records} loading={anecdotalQuery.isPending} />
        )}
      </div>
    </section>
  );
}
