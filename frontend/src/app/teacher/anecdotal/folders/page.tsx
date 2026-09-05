"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderCard } from "@/components/ui/FolderCard";
import {
  fetchMyRecords,
  type MyAnecdotalRecord,
} from "@/components/ocform01/folders";
import styles from "./components/folders.module.css";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then) || then < Date.UTC(2000, 0, 1)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface StudentGroup {
  studentId: string;
  studentName: string;
  lrn: string;
  section: string;
  records: MyAnecdotalRecord[];
  latest: string;
}

function groupByStudent(records: MyAnecdotalRecord[]): StudentGroup[] {
  const map = new Map<string, StudentGroup>();
  for (const r of records) {
    const existing = map.get(r.studentId);
    if (existing) {
      existing.records.push(r);
      if (r.observationDatetime > existing.latest) existing.latest = r.observationDatetime;
    } else {
      map.set(r.studentId, {
        studentId: r.studentId,
        studentName: r.studentName,
        lrn: r.lrn,
        section: r.section,
        records: [r],
        latest: r.observationDatetime,
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.latest < b.latest ? 1 : -1));
}

/**
 * Record folders hub: one folder appears automatically per student with
 * filed GCForm-01 records. Opening a folder shows that student's repository.
 */
export default function AnecdotalFoldersPage() {
  const recordsQuery = useQuery({
    queryKey: ["anecdotal-mine"],
    queryFn: fetchMyRecords,
  });

  const students = useMemo(
    () => groupByStudent(recordsQuery.data ?? []),
    [recordsQuery.data]
  );

  return (
    <section className={styles.page}>
      <Button type="button" variant="ghost" size="sm" asChild className={styles.backBtn}>
        <Link href="/teacher/anecdotal" aria-label="Back to filing chat">
          <ChevronLeft aria-hidden />
          Filing chat
        </Link>
      </Button>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Record folders</h1>
          <p className={styles.subtitle}>
            One folder per student with filed GCForm-01 records. Open a folder for
            that student&apos;s repository.
          </p>
        </div>
      </div>
      <hr className={styles.divider} />

      {recordsQuery.isError ? (
        <p className={styles.error}>Records could not be loaded. Check your connection.</p>
      ) : recordsQuery.isPending ? (
        <div className={styles.studentGrid} aria-busy="true" aria-label="Loading student folders">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} aria-hidden>
              <Skeleton className={styles.skelFolder} />
            </div>
          ))}
        </div>
      ) : students.length === 0 ? (
        <p className={styles.empty}>
          No filed records yet — file the first GCForm-01 from the chat.
        </p>
      ) : (
        <div className={styles.studentGrid}>
          {students.map((s) => (
            <Link
              key={s.studentId}
              href={`/teacher/anecdotal/folders/student/${s.studentId}`}
              className={styles.studentLink}
              aria-label={`Open ${s.studentName}'s record folder (${s.records.length} records)`}
            >
              <FolderCard
                label={s.studentName}
                sublabel={`${s.lrn} · ${s.section}`}
                files={[...s.records]
                  .sort((a, b) => (a.observationDatetime < b.observationDatetime ? 1 : -1))
                  .map((r) => ({
                    name: `OCForm-01_${r.observationDatetime.slice(0, 10)}`,
                    tag: `${humanize(r.category)} • ${timeAgo(r.observationDatetime)}`,
                    icon: "doc" as const,
                  }))}
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
