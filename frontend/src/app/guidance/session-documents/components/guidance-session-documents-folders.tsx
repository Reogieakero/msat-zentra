"use client";

import * as React from "react";
import { ImageViewer } from "@/components/image-viewer/ImageViewer";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Archive, Info, SearchX, Send } from "lucide-react";
import { GuidanceEmptyState } from "../../components/GuidanceEmptyCard";
import type { GuidanceAnecdotalRecord } from "@/services/guidance/anecdotal.types";
import {
  GuidanceAnecdotalFilters,
  type TypeFilter,
} from "@/app/guidance/anecdotal/components/guidance-anecdotal-filters";
import { Pagination } from "@/components/shared/pagination";
import { SessionDocumentKanbanCard } from "./SessionDocumentKanbanCard";
import { docSlipsFor } from "./session-doc-slips";
import styles from "./guidance-session-documents-folders.module.css";

function isEndorsedCase(type: string | undefined, status: string): boolean {
  return type === "ADM" && status === "in_progress";
}

interface GuidanceSessionDocumentsFoldersProps {
  records: GuidanceAnecdotalRecord[];
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  type: TypeFilter;
  onTypeChange: (value: TypeFilter) => void;
}

export function GuidanceSessionDocumentsFolders({
  records,
  page,
  total,
  onPageChange,
  query,
  onQueryChange,
  type,
  onTypeChange,
}: GuidanceSessionDocumentsFoldersProps) {
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const helpRef = React.useRef<HTMLDivElement>(null);
  const [gallery, setGallery] = React.useState<{
    record: GuidanceAnecdotalRecord;
    index: number;
  } | null>(null);
  const [galleryIndex, setGalleryIndex] = React.useState(0);

  React.useEffect(() => {
    if (!helpOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[data-slot="tooltip-content"]')) return;
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen]);

  const openGallery = (record: GuidanceAnecdotalRecord, index: number) => {
    // Filed session photos stay viewable even when the case is finished —
    // the counselor filed them, so resolved/closed folders open normally.
    // Only ADM-endorsed folders stay blocked (they live in the ADM queue).
    if (isEndorsedCase(record.referralType, record.referralStatus)) {
      setEndorsedFor(record.student);
      return;
    }
    setGallery({ record, index });
    setGalleryIndex(index);
  };

  return (
    <>
      <section aria-label="Session documents" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <GuidanceAnecdotalFilters
            query={query}
            onQueryChange={onQueryChange}
            type={type}
            onTypeChange={onTypeChange}
          />
          <TooltipProvider delayDuration={100}>
            <div className={styles.helpWrap} ref={helpRef}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setHelpOpen((open) => !open)}
                    aria-expanded={helpOpen}
                    aria-haspopup="dialog"
                    aria-label={
                      helpOpen
                        ? "Close about session documents"
                        : "About session documents"
                    }
                    className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                      helpOpen
                        ? "cursor-pointer border-amber-500/60 bg-amber-500/10"
                        : "cursor-pointer border-border bg-card hover:border-amber-500/60 hover:bg-amber-500/10"
                    }`}
                  >
                    <Info size={16} className="text-amber-500" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={10}>
                  <span className="font-medium">About session documents</span>
                  <span className="opacity-60">Filed session images</span>
                </TooltipContent>
              </Tooltip>

              <div
                role="dialog"
                aria-label="About session documents"
                aria-hidden={helpOpen ? undefined : true}
                className={`${styles.helpPanel} ${
                  helpOpen ? styles.helpPanelOpen : styles.helpPanelClosed
                }`}
              >
                <KanbanBoard
                  title="About session documents"
                  icon={
                    <span className="text-amber-500" aria-hidden>
                      <Info size={14} />
                    </span>
                  }
                  description="Images counselors filed on sessions, from referrals and interventions. The official GCForm-01 write-up for each case lives on the Anecdotal Records page."
                  className="border-0"
                  footer={
                    <div className="flex justify-end gap-1.5 px-1 pb-1">
                      <Button
                        type="button"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setHelpOpen(false)}
                      >
                        Got it
                      </Button>
                    </div>
                  }
                >
                  <ul className={styles.helpList}>
                    <li className={styles.helpRow}>
                      <span className={styles.helpRowIcon} aria-hidden>
                        <Archive size={14} />
                      </span>
                      <div>
                        <p className={styles.helpItemTitle}>
                          Finished cases — photos stay viewable
                        </p>
                        <p className={styles.helpItemText}>
                          Folders marked Resolved or Closed still open because the
                          photos are the case&apos;s filed evidence. Only the full
                          GCForm-01 write-up stays private on the Anecdotal
                          Records page.
                        </p>
                      </div>
                    </li>
                    <li className={styles.helpRow}>
                      <span className={styles.helpRowIcon} aria-hidden>
                        <Send size={14} />
                      </span>
                      <div>
                        <p className={styles.helpItemTitle}>
                          Endorsed cases — with the ADM coordinator
                        </p>
                        <p className={styles.helpItemText}>
                          Folders marked Endorsed can&apos;t be opened because the
                          case was endorsed to the ADM coordinator.
                        </p>
                      </div>
                    </li>
                  </ul>
                </KanbanBoard>
              </div>
            </div>
          </TooltipProvider>
        </div>

        {records.length === 0 ? (
          <GuidanceEmptyState
            icon={SearchX}
            title="No session documents here"
            hint="Try a different name or keyword, or clear the filter to see every filed image. GCForm-01 reports live on the Anecdotal Records page."
          />
        ) : (
          <>
            <div
              className={styles.studentGrid}
              role="list"
              aria-label="Session documents"
            >
              {records.map((record) => (
                <SessionDocumentKanbanCard
                  key={record.referralId}
                  record={record}
                  onOpenImage={openGallery}
                />
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalItems={total}
              onPageChange={onPageChange}
            />
          </>
        )}
      </section>

      {gallery ? (
        <ImageViewer
          files={docSlipsFor(gallery.record, 50).map((d) => ({
            ...d.image,
            fileName: `${d.file.tag.split(" • ")[0]} — ${d.image.fileName}`,
          }))}
          index={galleryIndex}
          title={gallery.record.student}
          subtitle={`${gallery.record.lrn} · ${gallery.record.section} · ${gallery.record.grade}`}
          onIndexChange={setGalleryIndex}
          onClose={() => setGallery(null)}
        />
      ) : null}

      <PrivacyNoticeDialog
        open={endorsedFor !== null}
        onClose={() => setEndorsedFor(null)}
        studentName={endorsedFor ?? undefined}
        reason="endorsed"
      />

    </>
  );
}
