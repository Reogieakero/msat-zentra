"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { NotebookPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  AnecdotalRecordKanbanCard,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { useTerm } from "@/lib/term/TermContext";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import styles from "./teacher-overview-advisory.module.css";

interface AnecdoteRow {
  id: string;
  observationDate: string;
  category: string;
  studentName: string;
  section: string;
  signed?: boolean;
}

function recordDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function TeacherOverviewAnecdotes() {
  const { activeTerm } = useTerm();
  const session = useSession();
  const teacherId = session?.sub ?? null;
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const anecdotesQuery = useQuery({
    // Term-scoped: never show Term A anecdotes for Term B.
    // Cached 30s / GC 5m like the rest of teacher overview.
    queryKey: ["teacher-anecdotes", teacherId ?? "anon", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<AnecdoteRow[]>("/api/anecdotal/referable?view=overview");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!teacherId,
    retry: false,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const rows = (anecdotesQuery.data ?? []).slice(0, 5);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  return (
    <section aria-label="Advisory anecdotal records" className="flex min-w-0 flex-col gap-3">
      {anecdotesQuery.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading anecdotes">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted" />
          ))}
        </div>
      ) : anecdotesQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load anecdotal records.
        </p>
      ) : rows.length === 0 ? (
        <>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={styles.sectionTitle}>Anecdotal Records</h2>
              <p className={styles.sectionDesc}>
                Filings for your advisees will appear here once recorded.
              </p>
            </div>
            <Link
              href="/teacher/anecdotal"
              className="shrink-0 text-xs font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
            >
              Open anecdotal records
            </Link>
          </div>
          <div
            className="flex w-full max-w-xs min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 [font-family:var(--font-inter)] dark:bg-muted/20"
            aria-label="No records yet"
          >
            <div
              className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2"
              aria-label="No records yet"
            >
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                <NotebookPen size={14} aria-hidden className="text-amber-500" />
                <span className="truncate">No records yet</span>
              </span>
            </div>
            <Link
              href="/teacher/chat?standalone=1&new=anecdotal"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="File via Chat with Bama (opens in a new tab)"
              className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg border bg-white p-3 shadow-sm transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-card"
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className="truncate text-[11px] font-medium text-muted-foreground"
                  title="/teacher/chat?standalone=1&new=anecdotal"
                >
                  /teacher/chat?standalone=1&amp;new=anecdotal
                </span>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground"
                  aria-hidden
                >
                  <StudentMascot name="Bama" character="crt" size={20} />
                </span>
              </span>
              <span className="truncate text-sm font-semibold leading-snug">
                File via Chat with Bama
              </span>
              <span className="text-xs leading-snug text-muted-foreground">
                Filings for your advisees will appear here once recorded.
              </span>
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={styles.sectionTitle}>Anecdotal Records</h2>
              <p className={styles.sectionDesc}>
                Latest filings for your advisees — category only, never the private write-up.
              </p>
            </div>
            <Link
              href="/teacher/anecdotal"
              className="shrink-0 text-xs font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
            >
              Open anecdotal records
            </Link>
          </div>
          <ul className={styles.kanbanGrid}>
            {rows.map((r) => (
              <li key={r.id} className="flex min-w-0">
                <AnecdotalRecordKanbanCard
                  category={r.category}
                  studentName={r.studentName}
                  metaText={r.section}
                  fileName={`GCForm-01_${recordDate(r.observationDate)}`}
                  fileTag={humanizeCategory(r.category)}
                  headerRight={
                    r.signed ? (
                      <Badge variant="green" className="shrink-0 rounded-md">
                        Signed
                      </Badge>
                    ) : undefined
                  }
                  openLabel={`Open ${r.studentName}'s record from ${recordDate(r.observationDate)}`}
                  onOpen={() => setPreviewId(r.id)}
                />
              </li>
            ))}
          </ul>
          <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
        </>
      )}
    </section>
  );
}
