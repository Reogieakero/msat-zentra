"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import {
  AnecdotalRecordKanbanCard,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { Button } from "@/components/ui/button";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { HelpCircle, SearchX } from "lucide-react";
import { GuidanceEmptyState } from "../../components/GuidanceEmptyCard";
import type { GuidanceAnecdotalRecord } from "@/services/guidance/anecdotal.types";
import {
  GuidanceAnecdotalFilters,
  type TypeFilter,
} from "./guidance-anecdotal-filters";
import { Pagination } from "@/components/shared/pagination";
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

interface GuidanceAnecdotalFoldersProps {
  records: GuidanceAnecdotalRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  type: TypeFilter;
  onTypeChange: (value: TypeFilter) => void;
  isNavigating?: boolean;
}

function isClosedStatus(status: string): boolean {
  return status === "resolved" || status === "dismissed";
}

type StatusVariant = "amber" | "green" | "red" | "blue" | "violet" | "outline";

function statusVariant(record: GuidanceAnecdotalRecord): StatusVariant {
  if (isEndorsedCase(record.referralType, record.referralStatus)) return "green";
  switch (record.referralStatus) {
    case "pending":
      return "amber";
    case "in_progress":
      return "blue";
    case "resolved":
      return "green";
    case "dismissed":
      return "outline";
    case "escalated":
      return "red";
    case "follow_up":
      return "violet";
    case "info_requested":
      return "blue";
    default:
      return "outline";
  }
}

function isEndorsedCase(type: string | undefined, status: string): boolean {
  return type === "ADM" && status === "in_progress";
}

function statusLabel(record: GuidanceAnecdotalRecord): string {
  if (isEndorsedCase(record.referralType, record.referralStatus)) return "Endorsed";
  switch (record.referralStatus) {
    case "pending":
      return "Pending";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Closed";
    case "escalated":
      return "Sent higher up";
    case "follow_up":
      return "Follow-up";
    case "info_requested":
      return "Needs more info";
    default:
      return humanize(record.referralStatus);
  }
}

export function GuidanceAnecdotalFolders({
  records,
  page,
  total,
  onPageChange,
  query,
  onQueryChange,
  type,
  onTypeChange,
}: GuidanceAnecdotalFoldersProps) {
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);

  const openRecord = (record: GuidanceAnecdotalRecord) => {

    if (isClosedStatus(record.referralStatus)) {
      setPrivacyFor(record.student);
    } else if (isEndorsedCase(record.referralType, record.referralStatus)) {
      setEndorsedFor(record.student);
    } else {
      setPreviewId(record.id);
    }
  };

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.titleRow}>
              <h2 className={styles.sectionTitle}>Referred GCForm-01 case files</h2>
              <button
                type="button"
                className={styles.helpBtn}
                onClick={() => setHelpOpen(true)}
                aria-label="Why can't I open some reports?"
                title="Why can't I open some reports?"
              >
                <HelpCircle aria-hidden="true" />
              </button>
            </div>
            <p className={styles.sectionDesc}>
              Every ADM and counseling case referred to you — {total} in all. Open a folder to
              read its GCForm-01.
            </p>
          </div>
          <div className={styles.headerActions}>
            <GuidanceAnecdotalFilters
              query={query}
              onQueryChange={onQueryChange}
              type={type}
              onTypeChange={onTypeChange}
            />
          </div>
        </div>
        <div className={styles.content}>
          <div className={styles.scrollArea}>
          {records.length === 0 ? (
            <GuidanceEmptyState
              icon={SearchX}
              title="No referred records here"
              hint="Try a different name or keyword, or clear the filter to see every referred case."
            />
          ) : (
            <div className={styles.studentGrid}>
              {records.map((record) => (
                <AnecdotalRecordKanbanCard
                  key={record.referralId}
                  category={record.category}
                  studentName={record.student}
                  plainName
                  mascotSeed={record.lrn}
                  lrn={record.lrn}
                  metaText={record.section}
                  metaTitle={`Section ${record.section}`}
                  metaLabel={record.grade || "Grade level"}
                  metaTone="amber"
                  fileName={`GCForm-01_${record.date}`}
                  fileTag={`${humanizeCategory(record.category)} • ${timeAgo(record.date)}`}
                  headerRight={
                    <Badge
                      variant={statusVariant(record)}
                      className="shrink-0 rounded-md"
                      title={statusLabel(record)}
                    >
                      {statusLabel(record)}
                    </Badge>
                  }
                  openLabel={`Preview ${record.student}'s record from ${record.date}`}
                  onOpen={() => openRecord(record)}
                />
              ))}
            </div>
          )}
          </div>
          <Pagination
            currentPage={page}
            totalItems={total}
            onPageChange={onPageChange}
          />
        </div>
      </div>

      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />

      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={() => setPrivacyFor(null)}
        studentName={privacyFor ?? undefined}
      />
      <PrivacyNoticeDialog
        open={endorsedFor !== null}
        onClose={() => setEndorsedFor(null)}
        studentName={endorsedFor ?? undefined}
        reason="endorsed"
      />

      <KanbanOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        width="lg"
        title="Why can&apos;t I open some reports?"
        description="Some folders stay listed but their full report never opens. The summary on the folder is all that remains visible."
        footer={
          <div className="flex items-center justify-end gap-1.5 px-1 pb-1">
            <Button type="button" onClick={() => setHelpOpen(false)}>
              Understood
            </Button>
          </div>
        }
      >
        <ul className={styles.helpList}>
          <li>
            <p className={styles.helpItemTitle}>Finished cases — kept private</p>
            <p className={styles.helpItemText}>
              Folders marked Resolved or Closed can&apos;t be opened because the case is finished.
              The full write-up stays hidden to protect the student&apos;s privacy.
            </p>
          </li>
          <li>
            <p className={styles.helpItemTitle}>Endorsed cases — with the ADM coordinator</p>
            <p className={styles.helpItemText}>
              Folders marked Endorsed can&apos;t be opened because the case was endorsed to the
              ADM coordinator. The full report moved with the case and is no longer viewable on
              this desk.
            </p>
          </li>
        </ul>
      </KanbanOverlay>
    </>
  );
}
