"use client";

import * as React from "react";
import { FileText, FolderOpen } from "lucide-react";
import { FolderCard } from "@/components/ui/FolderCard";
import { Input } from "@/components/ui/input";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Pill } from "@/components/ui/pill";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { sf10StatusLabel, sf10StatusTone } from "@/lib/labels/status-tone";
import { StudentMascot } from "../../referrals/components/StudentMascot";
import type { HasRow } from "@/services/teacher/sf10Access.service";
import { Sf10FolderCardSkeleton } from "./Sf10PageSkeleton";
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
  const [source, setSource] = React.useState<"original" | "autofill">("original");

  // Two independent lists: the registrar/record-keeper upload (never replaced
  // by auto-fill) and Bama's generated render. Switching tabs never hides the
  // other file — a student can appear in both with a different document.
  const originalRows = React.useMemo(
    () => rows.filter((r) => !!r.record?.fileUrl),
    [rows],
  );
  const autoFillRows = React.useMemo(
    () => rows.filter((r) => !!r.record?.autoFill?.fileUrl),
    [rows],
  );
  const activeRows = source === "original" ? originalRows : autoFillRows;

  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = activeRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const needle = query.trim();

  const switchSource = (next: "original" | "autofill") => {
    setSource(next);
    setPage(1);
  };

  return (
    <div className={`${styles.panel} flex flex-1 flex-col`}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>
            {source === "original" ? "Original SF10 files" : "Bama auto-fill files"}
          </h2>
          <p className={styles.sectionDesc}>
            {source === "original"
              ? `Uploaded by the registrar or record keeper — ${originalRows.length} of ${totalCount} granted student(s).`
              : `Rendered from adviser-approved finals — ${autoFillRows.length} student(s). The original upload stays in the other tab.`}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="SF10 file source"
          className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-self-center"
        >
          <button
            type="button"
            role="tab"
            aria-selected={source === "original"}
            onClick={() => switchSource("original")}
            className={
              source === "original"
                ? "inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400"
                : "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            }
          >
            Original file
            <span
              className={
                source === "original"
                  ? "text-blue-700/80 dark:text-blue-400/80"
                  : "text-muted-foreground/80"
              }
            >
              {originalRows.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={source === "autofill"}
            onClick={() => switchSource("autofill")}
            className={
              source === "autofill"
                ? "inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400"
                : "inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            }
          >
            Bama auto-fill
            <span
              className={
                source === "autofill"
                  ? "text-blue-700/80 dark:text-blue-400/80"
                  : "text-muted-foreground/80"
              }
            >
              {autoFillRows.length}
            </span>
          </button>
        </div>
        <div className={`${styles.headerActions} sm:justify-self-end`}>
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
                <Sf10FolderCardSkeleton key={i} />
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
                clear the search to see every {source === "original" ? "original" : "auto-fill"} SF10 file.
              </InsightCallout>
            </div>
          ) : pageRows.length === 0 ? (
            <div className={styles.empty}>
              <FolderOpen size={20} aria-hidden className="text-muted-foreground" />
              <p className={styles.emptyTitle}>
                {source === "original" ? "No approved files yet" : "No auto-fill files yet"}
              </p>
              <p className={styles.emptyBody}>
                {source === "original"
                  ? denied
                    ? "This request was denied. See the rejected list on the right."
                    : "Approved students will appear here as folders once the registrar or record keeper grants access."
                  : "Run SF10 auto-fill from Bama and the generated files land here. The registrar/record keeper uploads stay in the Original tab."}
              </p>
            </div>
          ) : (
            <div className={styles.folderGrid}>
              {pageRows.map((full) => {
                const activeUrl =
                  source === "original"
                    ? (full.record?.fileUrl ?? "")
                    : (full.record?.autoFill?.fileUrl ?? "");
                const ext = fileExtOf(activeUrl);
                const icon = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
                  ? ("image" as const)
                  : ["xlsx", "xls"].includes(ext)
                    ? ("chart" as const)
                    : ("doc" as const);
                const viewable = !!activeUrl && !!canAct;
                const tag =
                  source === "original"
                    ? `${sf10StatusLabel(full.sf10Status)} · ${full.gradeLevel} · ${full.section}`
                    : `Bama v${full.record?.autoFill?.version ?? full.record?.currentVersion ?? 1} · ${full.gradeLevel} · ${full.section}`;
                return (
                  <button
                    key={`${source}-${full.lrn}`}
                    type="button"
                    onClick={() => {
                      if (viewable) onOpen(activeUrl);
                    }}
                    disabled={!viewable}
                    aria-label={
                      viewable
                        ? `Open ${full.name}'s ${source === "original" ? "original" : "Bama auto-fill"} SF10 file in a new tab (view only, no download)`
                        : `${full.name}'s ${source === "original" ? "original" : "auto-fill"} SF10 file (not viewable yet)`
                    }
                    title={viewable ? "Open record in a new tab — view only" : undefined}
                    className="flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-border bg-muted/60 p-2.5 text-left transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow disabled:cursor-default dark:bg-muted/20"
                  >
                    <span className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b border-border px-3.5 pb-2">
                      <Pill
                        tone={source === "original" ? sf10StatusTone(full.sf10Status) : "blue"}
                        className="gap-1.5"
                      >
                        <FileText size={12} aria-hidden />
                        <span className="truncate">
                          {source === "original" ? sf10StatusLabel(full.sf10Status) : "Bama auto-fill"}
                        </span>
                      </Pill>
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
                          <Pill tone="amber" className="w-fit max-w-full" title={full.name}>
                            <span className="truncate">{full.name}</span>
                          </Pill>
                          <Pill
                            tone="neutral"
                            label="LRN"
                            className="w-fit max-w-full"
                            title={`${full.lrn} · ${full.gradeLevel} · ${full.section}`}
                          >
                            <span className="truncate">{full.lrn}</span>
                          </Pill>
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
                                tag,
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
          totalItems={activeRows.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
