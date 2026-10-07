"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ImageViewer } from "@/components/image-viewer/ImageViewer";
import { type ClinicAttachment } from "@/services/nurse/nurse.types";
import { type NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import { DocumentaryDetails } from "./DocumentaryDetails";
import { StudentHealthFolders } from "./StudentHealthFolders";
import { HealthRecordsSideRail } from "./HealthRecordsSideRail";
import {
  buildEntries,
  fileHref,
  groupEntriesByStudent,
  type DocEntry,
  type StudentHealthFolder,
} from "./documentaries-utils";
import styles from "./NurseDocumentariesList.module.css";

/**
 * Student health-records repository — one folder per student, same layout
 * as the anecdotal repository (folder grid + right insights rail).
 * Opening a folder reads that student's cases in the details dialog with
 * prev/next through their cases; files open in the image viewer.
 */
export function NurseDocumentariesList({ alerts }: { alerts: NurseAlertItem[] }) {
  const [selected, setSelected] = React.useState<{
    folder: StudentHealthFolder;
    index: number;
  } | null>(null);
  const [viewer, setViewer] = React.useState<{
    files: ClinicAttachment[];
    index: number;
    student: string;
    lrn: string;
    meta: string;
  } | null>(null);

  function openViewer(entry: DocEntry, index = 0) {
    if (entry.files.length === 0) return;
    setViewer({
      files: entry.files,
      index: Math.min(Math.max(index, 0), entry.files.length - 1),
      student: entry.row.student,
      lrn: entry.row.lrn,
      meta: [entry.row.grade, entry.row.section].filter((v) => v && v !== "—").join(" · "),
    });
  }
  function closeViewer() {
    setViewer(null);
  }

  const folders = React.useMemo(
    () => groupEntriesByStudent(buildEntries(alerts)),
    [alerts],
  );

  // No records: hide the folder grid and the right rail entirely — the
  // message sits in a centered glow card, same as registrar adviser-access.
  if (folders.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <section
          className={`${assign.card} ${styles.emptyCard}`}
          aria-label="No health records"
        >
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className={`${styles.empty} relative`}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <FolderOpen />
            </span>
            <p className={styles.emptyTitle}>No files stored yet</p>
            <p className={styles.emptyHint}>
              Finished clinic sessions and resolved cases will appear here,
              one folder per student.
            </p>
          </div>
        </section>
      </div>
    );
  }

  function openCase(folder: StudentHealthFolder, index: number) {
    if (folder.entries.length === 0) return;
    setSelected({
      folder,
      index: Math.min(Math.max(index, 0), folder.entries.length - 1),
    });
  }

  const activeEntry = selected?.folder.entries[selected.index] ?? null;
  const canPage = (selected?.folder.entries.length ?? 0) > 1;
  function stepCase(delta: 1 | -1) {
    setSelected((prev) => {
      if (!prev) return prev;
      const n = prev.folder.entries.length;
      return { folder: prev.folder, index: (prev.index + delta + n) % n };
    });
  }

  return (
    <section aria-label="Student health records">
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col">
          <StudentHealthFolders folders={folders} onOpenCase={openCase} />
        </div>
        <div className="hidden min-w-0 flex-col gap-4 lg:flex">
          <HealthRecordsSideRail folders={folders} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:hidden">
        <HealthRecordsSideRail folders={folders} />
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className={styles.dialogContent}>
          {canPage && selected && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => stepCase(-1)}
                aria-label="Previous case in this folder"
              >
                <ChevronLeft aria-hidden />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                Case {selected.index + 1} of {selected.folder.entries.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => stepCase(1)}
                aria-label="Next case in this folder"
              >
                Next
                <ChevronRight aria-hidden />
              </Button>
            </div>
          )}
          {activeEntry && (
            <DocumentaryDetails entry={activeEntry} onOpenViewer={openViewer} />
          )}
        </DialogContent>
      </Dialog>

      {viewer && viewer.files.length > 0 && (
        <ImageViewer
          files={viewer.files}
          index={viewer.index}
          title={viewer.student}
          subtitle={`${viewer.lrn}${viewer.meta ? ` · ${viewer.meta}` : ""}`}
          resolveHref={fileHref}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={closeViewer}
        />
      )}
    </section>
  );
}
