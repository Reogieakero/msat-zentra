"use client";

import * as React from "react";
import { FolderOpen, Search, SearchX } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ImageViewer } from "@/components/image-viewer/ImageViewer";
import { type ClinicAttachment } from "@/services/nurse/nurse.types";
import { type NurseAlertItem } from "@/services/nurse/nurse.types";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import { HealthRecordKanbanCard } from "./HealthRecordKanbanCard";
import { DocumentaryDetails } from "./DocumentaryDetails";
import {
  buildEntries,
  entryStatusLabel,
  fileHref,
  type DocEntry,
} from "./documentaries-utils";
import { PAGE_SIZE, ZentraPagination } from "@/components/shared/pagination";
import styles from "./NurseDocumentariesList.module.css";

/**
 * Nurse health records — one kanban folder-card per finished clinic session /
 * resolved case, laid out as a board (same card anatomy as the anecdotal
 * folders). Each card's right-side icons open a kanban board with that
 * record's session notes, outcome, documentation, and case info.
 */
export function NurseDocumentariesList({ alerts }: { alerts: NurseAlertItem[] }) {
  const entries = React.useMemo(() => buildEntries(alerts), [alerts]);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<DocEntry | null>(null);
  const [viewer, setViewer] = React.useState<{
    files: ClinicAttachment[];
    index: number;
    student: string;
    lrn: string;
    meta: string;
  } | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = React.useMemo(() => {
    if (!needle) return entries;
    return entries.filter((e) =>
      `${e.row.student} ${e.row.lrn} ${e.row.section} ${e.row.type} ${entryStatusLabel(e)}`
        .toLowerCase()
        .includes(needle),
    );
  }, [entries, needle]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEntries = visible.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function openViewer(entry: DocEntry, index: number) {
    if (entry.files.length === 0) return;
    setViewer({
      files: entry.files,
      index: Math.min(Math.max(index, 0), entry.files.length - 1),
      student: entry.row.student,
      lrn: entry.row.lrn,
      meta: [entry.row.grade, entry.row.section]
        .filter((v) => v && v !== "—")
        .join(" · "),
    });
  }

  if (entries.length === 0) {
    return (
      <NurseEmptyState
        icon={FolderOpen}
        title="No files stored yet"
        hint="Finished clinic sessions and resolved cases will appear here, one card per record."
      />
    );
  }

  return (
    <section aria-label="Student health records" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <InputGroup className="w-56 max-w-full shrink-0 rounded-[16px]">
          <InputGroupInput
            placeholder="Search student, LRN, section…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            aria-label="Search health records"
          />
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {visible.length === 0 ? (
        <NurseEmptyState
          icon={SearchX}
          title="No records match your search"
          hint="Try a different student name, LRN, section, or type."
        />
      ) : (
        <>
          <div className={styles.grid} role="list" aria-label="Health records">
            {pageEntries.map((entry) => (
              <HealthRecordKanbanCard
                key={entry.key}
                entry={entry}
                onOpenViewer={openViewer}
                onOpenDetails={setSelected}
              />
            ))}
          </div>
          <ZentraPagination
            currentPage={safePage}
            totalItems={visible.length}
            onPageChange={setPage}
          />
        </>
      )}

      {selected && (
        <DocumentaryDetails
          entry={selected}
          onOpenViewer={openViewer}
          onClose={() => setSelected(null)}
        />
      )}

      {viewer && viewer.files.length > 0 && (
        <ImageViewer
          files={viewer.files}
          index={viewer.index}
          title={viewer.student}
          subtitle={`${viewer.lrn}${viewer.meta ? ` · ${viewer.meta}` : ""}`}
          resolveHref={fileHref}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}
