"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { FolderCard } from "@/components/ui/FolderCard";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MyAnecdotalRecord } from "@/components/ocform01/folders";
import { CATEGORY_COLORS } from "./AnecdotalSideRail";
import styles from "./anecdotal-repo-folders.module.css";

const PAGE_SIZE = 20;

const CATEGORY_TONES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  behavioral: 1,
  bullying: 2,
  academic: 3,
  attendance: 4,
  health: 5,
};

// Folder body color per anecdotal category lives in the side rail module
// (single source of truth, shared with the legend).

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then) || then < Date.UTC(2000, 0, 1)) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function recordDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * The adviser's filed-records repository — one folder per filed anecdotal
 * record. Opening a folder overlays that record's GCForm-01 (the adviser
 * filed it, so the full write-up is theirs to open).
 */
export function AnecdotalRepoFolders({ records }: { records: MyAnecdotalRecord[] }) {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const needle = query.trim().toLowerCase();
  const visible = React.useMemo(() => {
    if (!needle) return records;
    return records.filter(
      (c) =>
        c.studentName.toLowerCase().includes(needle) ||
        c.lrn.toLowerCase().includes(needle) ||
        c.section.toLowerCase().includes(needle),
    );
  }, [records, needle]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <div className={`${styles.panel} flex flex-1 flex-col`}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.sectionTitle}>Advisory GCForm 01 records</h2>
            <p className={styles.sectionDesc}>
              Every anecdotal record filed for your advisory - {records.length} in all. Open a folder to read its GCForm-01.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Input
              className={styles.search}
              placeholder="Search folders…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search folders"
            />
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.scrollArea}>
          {records.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No filed records yet</p>
              <p className={styles.emptyBody}>
                File your first anecdotal record with Bama and it will land here.
              </p>
              <Button type="button" size="sm" onClick={() => router.push("/teacher/chat?new=anecdotal")}>
                <Plus aria-hidden />
                New record
              </Button>
            </div>
          ) : pageRows.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {needle ? "No folders match" : "No filed records on this page"}
              </p>
              <p className={styles.emptyBody}>
                {needle
                  ? `Nothing matches "${query}". Try a different name, LRN, or section.`
                  : "File your first anecdotal record with Bama and it will land here."}
              </p>
            </div>
          ) : (
            <div className={styles.folderGrid}>
              {pageRows.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={styles.folderBtn}
                  onClick={() => setPreviewId(c.id)}
                  aria-label={`Open ${c.studentName}'s record from ${recordDate(c.observationDatetime)}`}
                >
                  <FolderCard
                    label={c.studentName}
                    sublabel={`${c.lrn} - ${c.section}`}
                    folderColor={CATEGORY_COLORS[c.category]}
                    files={[
                      {
                        name: `GCForm-01_${recordDate(c.observationDatetime)}`,
                        tag: `${humanize(c.category)} - ${timeAgo(c.observationDatetime)}`,
                        tone: CATEGORY_TONES[c.category] ?? 1,
                        icon: "doc",
                      },
                    ]}
                  />
                </button>
              ))}
            </div>
          )}
          </div>
          {visible.length > PAGE_SIZE ? (
            <div className="relative flex items-center justify-end space-x-2">
              <div className="text-muted-foreground flex-1 text-sm">
                {visible.length} record{visible.length === 1 ? "" : "s"}
              </div>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
    </>
  );
}
