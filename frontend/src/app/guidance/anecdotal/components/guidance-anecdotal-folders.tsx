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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HelpCircle, Loader2 } from "lucide-react";
import type { GuidanceAnecdotalRecord } from "./guidance-anecdotal-data";
import {
  GuidanceAnecdotalFilters,
  type TypeFilter,
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

function statusColor(record: GuidanceAnecdotalRecord): string {
  if (isEndorsedCase(record.referralType, record.referralStatus)) return "#4ade80";
  switch (record.referralStatus) {
    case "pending":
      return "#fbbf24";
    case "in_progress":
      return "#e5e5e5";
    case "resolved":
      return "#4ade80";
    case "dismissed":
      return "#d4d4d4";
    case "escalated":
      return "#f87171";
    case "follow_up":
      return "#e5e5e5";
    case "info_requested":
      return "#e5e5e5";
    default:
      return "#e5e5e5";
  }
}

/**
 * Referred case files — one folder per referred case (same folder UI as the
 * adviser records page). Opening a folder overlays that referral's attached
 * GCForm-01 preview. Finished (resolved/dismissed) and endorsed (ADM +
 * in_progress) cases stay listed, but the full report never opens — the same
 * privacy overlays as the referrals page appear instead.
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
  type,
  onTypeChange,
  isNavigating = false,
}: GuidanceAnecdotalFoldersProps) {
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const openRecord = (record: GuidanceAnecdotalRecord) => {
    // Same gates as the referrals/alerts pages: finished
    // (resolved/dismissed) keeps the full write-up hidden for privacy;
    // endorsed (ADM + in_progress) moved to the ADM coordinator with its
    // full report — neither ever opens the official preview. Each folder
    // opens only its own attached record.
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
      <Card className={styles.panel}>
        <CardHeader className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.titleRow}>
              <CardTitle className={styles.sectionTitle}>Referred case files</CardTitle>
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
            <CardDescription className={styles.sectionDesc}>
              One folder per referred case — {total} record{total === 1 ? "" : "s"} referred
              to you.
            </CardDescription>
          </div>
          <CardAction className={styles.headerActions}>
            <GuidanceAnecdotalFilters
              query={query}
              onQueryChange={onQueryChange}
              type={type}
              onTypeChange={onTypeChange}
            />
          </CardAction>
        </CardHeader>
        <CardContent className={styles.content}>
          {records.length === 0 ? (
            <p className={styles.empty}>No referred records match the current filters.</p>
          ) : (
             <div className={styles.studentGrid}>
                {records.map((record) => (
                  <div key={record.id} className={styles.studentBlock}>
                    <button
                      type="button"
                      className={styles.studentFolderBtn}
                      onClick={() => openRecord(record)}
                      aria-label={`Preview ${record.student}'s record from ${record.date}`}
                    >
                      <span className={styles.folderWrap}>
                        <span className={styles.folderBadge} aria-hidden="true">
                          <span
                            className={styles.statusText}
                            style={{ color: statusColor(record) }}
                            title={statusLabel(record)}
                          >
                            {statusLabel(record)}
                          </span>
                        </span>
                        <FolderCard
                          label={record.student}
                          sublabel={`${record.lrn} · ${record.section}`}
                          files={[
                            {
                              name: `OCForm-01_${record.date}`,
                              tag: `${humanize(record.category)} • ${timeAgo(record.date)}`,
                              icon: "doc" as const,
                            },
                          ]}
                        />
                      </span>
                    </button>
                  </div>
                ))}
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
                disabled={page <= 1 || isNavigating}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </Button>
              <span className={styles.pageLabel} aria-live="polite">
                {isNavigating ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                    <Loader2 className="animate-spin" aria-hidden style={{ width: "0.875rem", height: "0.875rem" }} />
                    Loading…
                  </span>
                ) : (
                  `Page ${page} of ${totalPages}`
                )}
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={page >= totalPages || isNavigating}
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
      <PrivacyNoticeDialog
        open={endorsedFor !== null}
        onClose={() => setEndorsedFor(null)}
        studentName={endorsedFor ?? undefined}
        reason="endorsed"
      />

      <Dialog open={helpOpen} onOpenChange={(open) => !open && setHelpOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why can&apos;t I open some reports?</DialogTitle>
            <DialogDescription>
              Some folders stay listed but their full report never opens. The summary on the folder is all that remains visible.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button type="button" onClick={() => setHelpOpen(false)}>
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
