"use client";

import { useState } from "react";
import { FolderCard } from "@/components/ui/FolderCard";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import type { MyAnecdotalRecord } from "@/components/ocform01/folders";
import styles from "./folders.module.css";

const CATEGORY_TONES: Record<string, 1 | 2 | 3 | 4 | 5> = {
  behavioral: 1,
  bullying: 2,
  academic: 3,
  attendance: 4,
  health: 5,
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatRecordDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

interface RecordFolderGridProps {
  records: MyAnecdotalRecord[];
  emptyText: string;
}

/**
 * One FolderCard per filed record (same folder UI as the registrar SF10
 * feed). Clicking a card overlays the OCForm-01 report preview.
 */
export function RecordFolderGrid({
  records,
  emptyText,
}: RecordFolderGridProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (records.length === 0) {
    return <p className={styles.empty}>{emptyText}</p>;
  }

  return (
    <>
      <div className={styles.studentGrid}>
        {records.map((r) => (
          <button
            key={r.id}
            type="button"
            className={styles.recordFolderBtn}
            onClick={() => setPreviewId(r.id)}
            aria-haspopup="dialog"
            aria-label={`Preview ${humanize(r.category)} report from ${formatRecordDate(r.observationDatetime)}`}
          >
            <FolderCard
              label={humanize(r.category)}
              sublabel={`${formatRecordDate(r.observationDatetime)}${r.folderName ? ` · ${r.folderName}` : ""}`}
              files={[
                {
                  name:
                    r.incident.trim().length > 34
                      ? `${r.incident.trim().slice(0, 34)}…`
                      : r.incident.trim() || "GCForm-01 record",
                  tag: `${timeAgo(r.observationDatetime)} • ${humanize(r.confidentialityLevel)}`,
                  tone: CATEGORY_TONES[r.category] ?? 1,
                  icon: "doc",
                },
              ]}
            />
          </button>
        ))}
      </div>

      <OcForm01PreviewDialog
        recordId={previewId}
        onClose={() => setPreviewId(null)}
      />
    </>
  );
}
