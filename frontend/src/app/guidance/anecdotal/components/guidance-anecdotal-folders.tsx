"use client";

import * as React from "react";
import { FolderCard } from "@/components/ui/FolderCard";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { GuidanceAnecdotalRecord } from "./guidance-anecdotal-data";
import {
  GuidanceAnecdotalFilters,
  type CategoryFilter,
} from "./guidance-anecdotal-filters";
import styles from "./guidance-anecdotal-folders.module.css";

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function timeAgo(iso: string): string {
  const then = new Date(`${iso}T00:00:00`).getTime();
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

interface StudentGroup {
  key: string;
  studentName: string;
  lrn: string;
  section: string;
  records: GuidanceAnecdotalRecord[];
}

function groupByStudent(records: GuidanceAnecdotalRecord[]): StudentGroup[] {
  const map = new Map<string, StudentGroup>();
  for (const r of records) {
    const key = r.lrn || r.student;
    const existing = map.get(key);
    if (existing) {
      existing.records.push(r);
    } else {
      map.set(key, {
        key,
        studentName: r.student,
        lrn: r.lrn,
        section: r.section,
        records: [r],
      });
    }
  }
  return [...map.values()];
}

interface GuidanceAnecdotalFoldersProps {
  records: GuidanceAnecdotalRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
}

/**
 * Referred case files as student folders (same folder UI as the adviser
 * records page). Opening a student folder opens the first filing's
 * GCForm-01 preview; opening a filing overlays the official GCForm-01 preview.
 * Guidance viewing is read-only — the sign flow never activates for this
 * role because they are never the signatory.
 */
export function GuidanceAnecdotalFolders({
  records,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  query,
  onQueryChange,
  category,
  onCategoryChange,
}: GuidanceAnecdotalFoldersProps) {
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);

  const groups = React.useMemo(() => groupByStudent(records), [records]);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const openFirstPreview = (groupRecords: GuidanceAnecdotalRecord[]) => {
    if (groupRecords.length > 0) {
      const sorted = [...groupRecords].sort((a, b) =>
        a.date < b.date ? 1 : -1
      );
      const newest = sorted[0];
      // Finished cases stay listed, but the full report is hidden for privacy.
      if (
        newest.referralStatus === "resolved" ||
        newest.referralStatus === "dismissed"
      ) {
        setPrivacyFor(newest.student);
      } else {
        setPreviewId(newest.id);
      }
    }
  };

  return (
    <>
      <Card className={styles.panel}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <CardTitle className={styles.sectionTitle}>Referred case files</CardTitle>
            <CardDescription className={styles.sectionDesc}>
              One folder per student — {total} record{total === 1 ? "" : "s"} referred
              to you.
            </CardDescription>
          </div>
          <CardAction className={styles.headerActions}>
            <GuidanceAnecdotalFilters
              query={query}
              onQueryChange={onQueryChange}
              category={category}
              onCategoryChange={onCategoryChange}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className={styles.empty}>No referred records match the current filters.</p>
          ) : (
             <div className={styles.studentGrid}>
                {groups.map((group) => {
                  const sorted = [...group.records].sort((a, b) =>
                    a.date < b.date ? 1 : -1
                  );
                  return (
                    <div key={group.key} className={styles.studentBlock}>
                      <button
                        type="button"
                        className={styles.studentFolderBtn}
                        onClick={() => openFirstPreview(group.records)}
                        aria-label={`Preview ${group.studentName}'s first record`}
                      >
                        <FolderCard
                          label={group.studentName}
                          sublabel={`${group.lrn} · ${group.section}`}
                          files={sorted.map((r) => ({
                            name: `OCForm-01_${r.date}`,
                            tag: `${humanize(r.category)} • ${timeAgo(r.date)}`,
                            icon: "doc" as const,
                          }))}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
          )}
          <div className={styles.pager}>
            <p className={styles.range}>
              Showing {start}–{end} of {total}
            </p>
            <div className={styles.pagerButtons}>
              <Button
                size="xs"
                variant="outline"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <span className={styles.pageLabel}>
                Page {page} of {totalPages}
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />

      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={() => setPrivacyFor(null)}
        studentName={privacyFor ?? undefined}
      />
    </>
  );
}
