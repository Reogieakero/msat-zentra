"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyRecords } from "@/components/ocform01/folders";
import { RecordFolderGrid } from "../../components/RecordFolderGrid";
import styles from "../../components/folders.module.css";

export default function StudentRecordFolderPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = decodeURIComponent(params.studentId);
  const router = useRouter();

  const recordsQuery = useQuery({
    queryKey: ["anecdotal-mine"],
    queryFn: fetchMyRecords,
  });

  const records = useMemo(
    () => (recordsQuery.data ?? []).filter((r) => r.studentId === studentId),
    [recordsQuery.data, studentId]
  );
  const head = records[0] ?? null;

  function goBack() {
    // Return to wherever the teacher came from (advisory list, hub, chat);
    // fall back to the folders hub on a direct visit with no history.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/teacher/anecdotal/folders");
    }
  }

  if (recordsQuery.isPending) {
    return (
      <section className={styles.page}>
        <Button type="button" variant="ghost" size="sm" onClick={goBack} className={styles.backBtn} aria-label="Back to previous page">
          <ChevronLeft aria-hidden />
          Back
        </Button>
        <div className={styles.header}>
          <div>
            <Skeleton className={styles.skelTitle} />
            <Skeleton className={styles.skelSub} />
          </div>
        </div>
        <hr className={styles.divider} />
        <div
          className={styles.studentGrid}
          aria-busy="true"
          aria-label="Loading student repository"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden>
              <Skeleton className={styles.skelFolder} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (recordsQuery.isError || !head) {
    return (
      <section className={styles.page}>
        <Button type="button" variant="ghost" size="sm" onClick={goBack} className={styles.backBtn} aria-label="Back to previous page">
          <ChevronLeft aria-hidden />
          Back
        </Button>
        <p className={styles.error}>
          This student&apos;s repository is unavailable — you may not have filed
          records for them.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Button type="button" variant="ghost" size="sm" onClick={goBack} className={styles.backBtn} aria-label="Back to previous page">
        <ChevronLeft aria-hidden />
        Back
      </Button>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{head.studentName}</h1>
          <p className={styles.subtitle}>
            {head.lrn} · {head.section} · {records.length} record
            {records.length === 1 ? "" : "s"} filed by you
          </p>
        </div>
      </div>
      <hr className={styles.divider} />

      <RecordFolderGrid
        records={[...records].sort((a, b) =>
          a.observationDatetime < b.observationDatetime ? 1 : -1
        )}
        emptyText="No records here."
      />
    </section>
  );
}

