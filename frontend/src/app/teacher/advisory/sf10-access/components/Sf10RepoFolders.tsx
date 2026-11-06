"use client";

import * as React from "react";
import { FileText, FolderOpen } from "lucide-react";
import { FolderCard } from "@/components/ui/FolderCard";
import { Input } from "@/components/ui/input";
import { InsightCallout } from "@/components/ui/insight-callout";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { StudentMascot } from "../../referrals/components/StudentMascot";
import type { HasRow } from "@/services/teacher/sf10Access.service";
import styles from "./sf10-repo-folders.module.css";

function fileExtOf(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  } catch {
    return url.split("?")[0].split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  }
}

const STATUS_TONES: Record<HasRow["sf10Status"], 1 | 2 | 3 | 4 | 5> = {
  pending: 1,
  verified: 3,
  validated: 5,
};

function statusLabel(status: HasRow["sf10Status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface Sf10RepoFoldersProps {
  rows: HasRow[];
  totalCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  canAct: boolean | undefined;
  pending: boolean;
  error: boolean;
  denied: boolean;
  onOpen: (fileUrl: string) => void;
}

export function Sf10RepoFolders({
  rows,
  totalCount,
  query,
  onQueryChange,
  canAct,
  pending,
  error,
  denied,
  onOpen,
}: Sf10RepoFoldersProps) {
  const [page, setPage] = React.useState(1);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const needle = query.trim();

  return (
    <div className={`${styles.panel} flex flex-1 flex-col`}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Approved SF10 files</h2>
          <p className={styles.sectionDesc}>
            Every advisory student granted SF10 read access - {totalCount} in all. Open a folder to view its SF10.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Input
            className={`${styles.search} h-8 rounded-[16px]`}
            placeholder="Search folders…"
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setPage(1);
            }}
            aria-label="Search folders"
          />
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.scrollArea}>
          {pending ? (
            <div className={styles.folderGrid} aria-busy="true" aria-label="Loading approved files">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
                  aria-hidden
                >
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-24 w-full animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className={styles.empty} role="alert">
              <p className={styles.emptyTitle}>Could not load verification</p>
              <p className={styles.emptyBody}>
                The approved list could not be loaded for this request. Check your connection and try again.
              </p>
            </div>
          ) : pageRows.length === 0 && needle ? (
            <div className="flex w-full justify-center px-1 py-10">
              <InsightCallout role="status" className="w-full max-w-xl text-left">
                <strong>No folders match “{query}”.</strong> Try a different name or LRN — or
                clear the search to see every approved SF10 file.
              </InsightCallout>
            </div>
          ) : pageRows.length === 0 ? (
            <div className={styles.empty}>
              <FolderOpen size={20} aria-hidden className="text-muted-foreground" />
              <p className={styles.emptyTitle}>No approved files yet</p>
              <p className={styles.emptyBody}>
                {denied
                  ? "This request was denied. See the rejected list on the right."
                  : "Approved students will appear here as folders once the registrar or record keeper grants access."}
              </p>
            </div>
          ) : (
            <div className={styles.folderGrid}>
              {pageRows.map((full) => {
                const ext = fileExtOf(full.record?.fileUrl ?? "");
                const icon = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
                  ? ("image" as const)
                  : ["xlsx", "xls"].includes(ext)
                    ? ("chart" as const)
                    : ("doc" as const);
                const viewable = !!full.record?.fileUrl && !!canAct;
                return (
                  <button
                    key={full.lrn}
                    type="button"
                    onClick={() => {
                      if (viewable) onOpen(full.record!.fileUrl!);
                    }}
                    disabled={!viewable}
                    aria-label={
                      viewable
                        ? `Open ${full.name}'s SF10 record in a new tab (view only, no download)`
                        : `${full.name}'s SF10 record (not viewable yet)`
                    }
                    title={viewable ? "Open record in a new tab — view only" : undefined}
                    className="flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 text-left transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow disabled:cursor-default dark:bg-muted/20"
                  >
                    <span className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                        <FileText size={14} aria-hidden className="text-amber-500" />
                        <span className="truncate">{statusLabel(full.sf10Status)}</span>
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm dark:bg-card">
                      <span className="flex min-w-0 items-center gap-2">
                        <StudentMascot
                          name={full.name}
                          seed={full.lrn}
                          character={full.mascot ?? undefined}
                          size={32}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span
                            className="inline-flex w-fit max-w-full items-center truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold leading-tight text-amber-700 dark:text-amber-400"
                            title={full.name}
                          >
                            {full.name}
                          </span>
                          <span
                            className="inline-flex w-fit max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium leading-tight text-secondary-foreground"
                            title={`${full.lrn} · ${full.gradeLevel} · ${full.section}`}
                          >
                            {full.lrn}
                          </span>
                        </span>
                      </span>
                      <span className="flex w-full justify-center">
                        <span className="w-full max-w-[220px]">
                          <FolderCard
                            label=""
                            folderColor="#f59e0b"
                            files={[
                              {
                                name: ext ? `SF10.${ext}` : "SF10 file",
                                tag: `${statusLabel(full.sf10Status)} · ${full.gradeLevel} · ${full.section}`,
                                tone: STATUS_TONES[full.sf10Status] ?? 1,
                                icon,
                              },
                            ]}
                          />
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Pagination
          currentPage={safePage}
          totalItems={rows.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
