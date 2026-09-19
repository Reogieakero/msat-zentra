"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { type ClinicAttachment } from "../../overview/components/nurse-overview-data";
import { type NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import { DocumentaryTable } from "./DocumentaryTable";
import { DocumentaryDetails } from "./DocumentaryDetails";
import {
  buildEntries,
  fileHref,
  sortEntries,
  TYPE_OPTIONS,
  PAGE_SIZE,
  type DocEntry,
  type TypeFilter,
  type SortKey,
} from "./documentaries-utils";
import styles from "./NurseDocumentariesList.module.css";

export function NurseDocumentariesList({ alerts }: { alerts: NurseAlertItem[] }) {
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("");
  const [sortKey, setSortKey] = React.useState<SortKey>("date");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<DocEntry | null>(null);
  const [viewer, setViewer] = React.useState<{
    files: ClinicAttachment[];
    index: number;
    student: string;
    lrn: string;
    meta: string;
  } | null>(null);

  const viewerCount = viewer?.files.length ?? 0;
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
  function stepViewer(dir: 1 | -1) {
    setViewer((v) => {
      if (!v || v.files.length === 0) return v;
      const n = v.files.length;
      return { ...v, index: (v.index + dir + n) % n };
    });
  }

  React.useEffect(() => {
    if (!viewer) return;
    const count = viewer.files.length;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowRight" && count > 1) stepViewer(1);
      if (e.key === "ArrowLeft" && count > 1) stepViewer(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer]);

  const entries = React.useMemo(() => buildEntries(alerts), [alerts]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = entries.filter((e) => {
      if (typeFilter !== "" && e.row.type !== typeFilter) return false;
      if (q !== "" && !`${e.row.id} ${e.row.student} ${e.row.lrn} ${e.row.section} ${e.row.reason} ${e.row.category} ${e.details} ${e.outcome}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortEntries(result, sortKey, sortDir);
  }, [entries, query, typeFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  }

  function openDetails(entry: DocEntry) {
    setSelected(entry);
  }
  function clearFilters() {
    setQuery("");
    setTypeFilter("");
    setPage(1);
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label ?? "All types";
  const hasActiveFilters = query.trim() !== "" || typeFilter !== "";

  return (
    <section aria-label="Student documentaries">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Documentaries</h2>
          <p className={styles.sectionDesc}>
            Finished transactions — {total} record{total === 1 ? "" : "s"}.
          </p>
        </div>
        {entries.length > 0 && (
          <div className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                style={{ height: "2rem" }}
                placeholder="Search by referral ID, student or keyword…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                aria-label="Search documentaries"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ height: "2rem" }}
                  aria-label={`Filter by type, currently showing: ${typeLabel}`}
                  className={`${styles.filterBtn} ${typeFilter !== "" ? styles.filterActive : ""}`}
                >
                  {typeFilter === "" ? "Type" : typeLabel}
                  {typeFilter !== "" && <span className={styles.filterDot} aria-hidden />}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={styles.filterMenu}>
                {TYPE_OPTIONS.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.label}
                    checked={typeFilter === item.value}
                    onCheckedChange={() => { setTypeFilter(item.value); setPage(1); }}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className={styles.clearBtn} onClick={clearFilters}>
                <X aria-hidden />
                Show all
              </Button>
            )}
          </div>
        )}
      </div>

      <DocumentaryTable
        filtered={filtered}
        pageRows={pageRows}
        total={total}
        start={start}
        end={end}
        safePage={safePage}
        totalPages={totalPages}
        onSort={toggleSort}
        onPageChange={setPage}
        onOpenDetails={openDetails}
        onOpenViewer={openViewer}
      />

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className={styles.dialogContent}>
          {selected && (
            <DocumentaryDetails entry={selected} onOpenViewer={openViewer} />
          )}
        </DialogContent>
      </Dialog>

      {viewer && viewer.files.length > 0 && (
        <div className={styles.viewerBackdrop} role="dialog" aria-modal="true" aria-label={`Image viewer for ${viewer.student} — ${viewer.index + 1} of ${viewer.files.length}`} onClick={closeViewer}>
          <div className={styles.viewerContent} onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" onClick={closeViewer} aria-label="Close">
              <X aria-hidden />
              <span className="sr-only">Close</span>
            </Button>
            <div className={styles.viewerHead}>
              <p className={styles.viewerStudent}>{viewer.student}</p>
              <p className={styles.viewerSub}>
                <span className={styles.lrn}>{viewer.lrn}</span>
                {viewer.meta ? <><span aria-hidden="true"> · </span><span>{viewer.meta}</span></> : null}
              </p>
            </div>
            {viewerCount > 1 && (
              <button type="button" className={`${styles.viewerNav} ${styles.viewerPrev}`} onClick={() => stepViewer(-1)} aria-label="Previous image">
                <ChevronLeft size={22} aria-hidden />
              </button>
            )}
            <img key={viewer.files[viewer.index].id} src={fileHref(viewer.files[viewer.index].fileUrl)} alt={viewer.files[viewer.index].fileName} className={styles.viewerImage} />
            {viewerCount > 1 && (
              <button type="button" className={`${styles.viewerNav} ${styles.viewerNext}`} onClick={() => stepViewer(1)} aria-label="Next image">
                <ChevronRight size={22} aria-hidden />
              </button>
            )}
            <div className={styles.viewerFooter}>
              <p className={styles.viewerName}>{viewer.files[viewer.index].fileName}</p>
              {viewerCount > 1 && (
                <p className={styles.viewerCounter} aria-live="polite">{viewer.index + 1} / {viewerCount}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
