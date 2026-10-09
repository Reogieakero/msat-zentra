"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { NotebookPen } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import { FolderCard } from "@/components/ui/FolderCard";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./teacher-overview-advisory.module.css";

interface AnecdoteRow {
  id: string;
  observationDate: string;
  category: string;
  studentName: string;
  section: string;
}

const CATEGORY_TONES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  behavioral: 1,
  bullying: 2,
  academic: 3,
  attendance: 4,
  health: 5,
};

const CATEGORY_COLORS: Record<string, string> = {
  behavioral: "#f59e0b",
  bullying: "#ef4444",
  academic: "#3b82f6",
  attendance: "#22c55e",
  health: "#8b5cf6",
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function recordDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function TeacherOverviewAnecdotes() {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const anecdotesQuery = useQuery({
    // Term-scoped: never show Term A anecdotes for Term B.
    queryKey: ["teacher-anecdotes", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<AnecdoteRow[]>("/api/anecdotal/referable");
      return Array.isArray(data) ? data : [];
    },
    retry: false,
  });

  const rows = (anecdotesQuery.data ?? []).slice(0, 5);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  return (
    <section aria-label="Advisory anecdotal records" className="flex min-w-0 flex-col gap-3">
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
      {anecdotesQuery.isPending ? (
        <div className="relative flex flex-col gap-2" aria-busy="true" aria-label="Loading anecdotes">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-md bg-muted" />
          ))}
        </div>
      ) : anecdotesQuery.isError ? (
        <p role="alert" className="relative text-sm text-destructive">
          Could not load anecdotal records.
        </p>
      ) : rows.length === 0 ? (
        <div className="relative flex flex-col items-center gap-2 py-6 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
            aria-hidden="true"
          >
            <NotebookPen size={24} className="text-muted-foreground" />
          </span>
          <p className="font-medium">No anecdotal records yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Filings for your advisees will appear here once recorded.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <h2 className={styles.sectionTitle}>Anecdotal Records</h2>
            <p className={styles.sectionDesc}>
              Latest filings for your advisees — category only, never the private write-up.
            </p>
          </div>
          <ul className="relative grid min-w-0 grid-cols-2 items-start justify-items-center gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {rows.map((r) => (
              <li key={r.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setPreviewId(r.id)}
                  aria-label={`Open ${r.studentName}'s record from ${recordDate(r.observationDate)}`}
                  className="cursor-pointer"
                >
                  <FolderCard
                    label={r.studentName}
                    sublabel={r.section}
                    folderColor={CATEGORY_COLORS[r.category]}
                    files={[
                      {
                        name: `GCForm-01_${recordDate(r.observationDate)}`,
                        tag: humanize(r.category),
                        tone: CATEGORY_TONES[r.category] ?? 1,
                        icon: "doc",
                      },
                    ]}
                  />
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/teacher/anecdotal"
            className="relative text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open anecdotal records
          </Link>
          <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
        </>
      )}
      </div>
    </section>
  );
}
