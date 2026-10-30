"use client";

import * as React from "react";
import { Plus, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import {
  AnecdotalRecordKanbanCard,
  humanizeCategory,
} from "@/components/anecdotal/anecdotal-record-kanban-card";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { InsightCallout } from "@/components/ui/insight-callout";
import type { MyAnecdotalRecord } from "@/components/ocform01/folders";
import styles from "./anecdotal-repo-folders.module.css";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";

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

export function AnecdotalRepoFolders({ records }: { records: MyAnecdotalRecord[] }) {
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
        <div className="flex w-full items-center justify-end gap-2 pt-1">
          <InputGroup className="h-9 w-full max-w-56 shrink-0 rounded-full">
            <InputGroupInput
              className="h-full py-0 text-sm"
              placeholder="Search folders…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search folders"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className={styles.content}>
          <div className={styles.scrollArea}>
          {records.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No filed records yet</p>
              <p className={styles.emptyBody}>
                File your first anecdotal record with Bama and it will land here.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  window.open("/teacher/chat?standalone=1&new=anecdotal", "_blank", "noopener,noreferrer")
                }
              >
                <Plus aria-hidden />
                New record
              </Button>
            </div>
          ) : pageRows.length === 0 && needle ? (
            <div className="flex w-full justify-center px-1 py-10">
              <InsightCallout role="status" className="w-full max-w-xl text-left">
                <strong>No folders match “{query}”.</strong> Try a different name,
                LRN, or section — or clear the search to see every filed record.
              </InsightCallout>
            </div>
          ) : pageRows.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No filed records on this page</p>
              <p className={styles.emptyBody}>
                File your first anecdotal record with Bama and it will land here.
              </p>
            </div>
          ) : (
            <div className={styles.folderGrid}>
              {pageRows.map((c) => (
                <AnecdotalRecordKanbanCard
                  key={c.id}
                  category={c.category}
                  studentName={c.studentName}
                  metaText={c.lrn}
                  metaTitle={`${c.lrn} · ${c.section}`}
                  fileName={`GCForm-01_${recordDate(c.observationDatetime)}`}
                  fileTag={`${humanizeCategory(c.category)} - ${timeAgo(c.observationDatetime)}`}
                  headerRight={
                    c.signed ? (
                      <Badge variant="green" className="shrink-0 rounded-md">
                        Signed
                      </Badge>
                    ) : undefined
                  }
                  openLabel={`Open ${c.studentName}'s record from ${recordDate(c.observationDatetime)}`}
                  onOpen={() => setPreviewId(c.id)}
                />
              ))}
            </div>
          )}
          </div>
          <Pagination
            currentPage={safePage}
            totalItems={visible.length}
            onPageChange={setPage}
          />
        </div>
      </div>

      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />
    </>
  );
}
