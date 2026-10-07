"use client";

import * as React from "react";
import { FolderCard, type FolderFile } from "@/components/ui/FolderCard";
import { ImageViewer } from "@/components/image-viewer/ImageViewer";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
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
import { CATEGORY_COLORS } from "@/app/teacher/anecdotal/components/AnecdotalSideRail";
import type { GuidanceAnecdotalRecord } from "@/services/guidance/anecdotal.types";
import {
  GuidanceAnecdotalFilters,
  type TypeFilter,
} from "@/app/guidance/anecdotal/components/guidance-anecdotal-filters";
import styles from "./guidance-session-documents-folders.module.css";

/* Session-type wording + color coding for documentation slips (matches
   the folder slip palette). */
const SESSION_KIND_LABEL: Record<string, string> = {
  individual: "One-on-one",
  parent_conference: "Parent conference",
  group: "Group",
  home_visit: "Home visit",
};

type SessionKind = "individual" | "parent_conference" | "group" | "home_visit";

function sessionKindOf(value: string): SessionKind {
  return value === "parent_conference" ||
    value === "group" ||
    value === "home_visit"
    ? value
    : "individual";
}

function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
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
      return record.referralStatus;
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
    default:
      return "#e5e5e5";
  }
}

export interface DocEntry {
  file: FolderFile;
  image: { id: string; fileUrl: string; fileName: string };
}

/** Flatten a record's filed session images (oldest first) into folder slips. */
export function docSlipsFor(record: GuidanceAnecdotalRecord, cap = 5): DocEntry[] {
  const docs: DocEntry[] = [];
  for (const s of record.sessionDocs ?? []) {
    const kind = sessionKindOf(s.sessionType);
    for (const f of s.files) {
      if (!isImageMime(f.mimeType)) continue;
      docs.push({
        file: {
          name: f.fileName,
          tag: `${SESSION_KIND_LABEL[kind]} • ${s.date}`,
          tone: ((docs.length % 5) + 1) as FolderFile["tone"],
          icon: "image",
          sessionKind: kind,
        },
        image: { id: f.id, fileUrl: f.fileUrl, fileName: f.fileName },
      });
      if (docs.length >= cap) break;
    }
    if (docs.length >= cap) break;
  }
  return docs;
}

interface GuidanceSessionDocumentsFoldersProps {
  records: GuidanceAnecdotalRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totalFiles: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  type: TypeFilter;
  onTypeChange: (value: TypeFilter) => void;
  isNavigating?: boolean;
}

/**
 * Session documentation — one folder per referred case that has filed
 * images from done counseling sessions. GCForm-01 reports stay on the
 * Anecdotal Records page; this page is images only.
 */
export function GuidanceSessionDocumentsFolders({
  records,
  page,
  pageSize,
  total,
  totalPages,
  totalFiles,
  onPageChange,
  query,
  onQueryChange,
  type,
  onTypeChange,
  isNavigating = false,
}: GuidanceSessionDocumentsFoldersProps) {
  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [gallery, setGallery] = React.useState<{
    record: GuidanceAnecdotalRecord;
    index: number;
  } | null>(null);
  const [galleryIndex, setGalleryIndex] = React.useState(0);

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const openGallery = (record: GuidanceAnecdotalRecord, index: number) => {
    if (isClosedStatus(record.referralStatus)) {
      setPrivacyFor(record.student);
      return;
    }
    if (isEndorsedCase(record.referralType, record.referralStatus)) {
      setEndorsedFor(record.student);
      return;
    }
    setGallery({ record, index });
    setGalleryIndex(index);
  };

  return (
    <>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.titleRow}>
              <h2 className={styles.sectionTitle}>Session documents</h2>
              <button
                type="button"
                className={styles.helpBtn}
                onClick={() => setHelpOpen(true)}
                aria-label="About session documents"
                title="About session documents"
              >
                <HelpCircle aria-hidden="true" />
              </button>
            </div>
            <p className={styles.sectionDesc}>
              Filed images from done counseling sessions — {totalFiles} in all across {total}{" "}
              {total === 1 ? "case" : "cases"}. Open a folder to browse its images.
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
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>No session documents here</p>
                <p className={styles.emptyBody}>
                  Try a different name or keyword, or clear the filter to see every filed image.
                  GCForm-01 reports live on the Anecdotal Records page.
                </p>
              </div>
            ) : (
              <div className={styles.studentGrid}>
                {records.map((record) => {
                  const docs = docSlipsFor(record);
                  return (
                    <div key={record.referralId} className={styles.studentBlock}>
                      {/* Plain div (not <button>) so the inner slip <button>s
                          from FolderCard never nest inside another button. */}
                      <div
                        role="button"
                        tabIndex={0}
                        className={styles.studentFolderBtn}
                        onClick={() => openGallery(record, 0)}
                        onKeyDown={(e) => {
                          // Ignore key events bubbling up from the inner slip
                          // <button>s — they have their own keyboard handling.
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openGallery(record, 0);
                          }
                        }}
                        aria-label={`Browse ${record.student}'s session documents`}
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
                            folderColor={CATEGORY_COLORS[record.category]}
                            files={docs.map((d) => d.file)}
                            onFileClick={(index) => openGallery(record, index)}
                          />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className={styles.pager}>
            <p className={styles.range}>
              Showing {start}–{end} of {total}
            </p>
            <div className={styles.pagerButtons}>
              <Button
                size="sm"
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
                size="sm"
                variant="outline"
                disabled={page >= totalPages || isNavigating}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {gallery ? (
        <ImageViewer
          files={docSlipsFor(gallery.record, 50).map((d) => d.image)}
          index={galleryIndex}
          title={`${gallery.record.student} — session documentation`}
          subtitle={`${gallery.record.lrn} · ${gallery.record.section}`}
          onIndexChange={setGalleryIndex}
          onClose={() => setGallery(null)}
        />
      ) : null}

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
            <DialogTitle>About session documents</DialogTitle>
            <DialogDescription>
              Images counselors filed from done sessions. The official GCForm-01 write-up for
              each case lives on the Anecdotal Records page.
            </DialogDescription>
          </DialogHeader>
          <ul className={styles.helpList}>
            <li>
              <p className={styles.helpItemTitle}>Finished cases — kept private</p>
              <p className={styles.helpItemText}>
                Folders marked Resolved or Closed can&apos;t be opened because the case is finished.
                The filed images stay hidden to protect the student&apos;s privacy.
              </p>
            </li>
            <li>
              <p className={styles.helpItemTitle}>Endorsed cases — with the ADM coordinator</p>
              <p className={styles.helpItemText}>
                Folders marked Endorsed can&apos;t be opened because the case was endorsed to the
                ADM coordinator.
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
