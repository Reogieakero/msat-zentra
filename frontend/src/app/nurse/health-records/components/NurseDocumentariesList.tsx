"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
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
import { ImageViewer } from "@/components/image-viewer/ImageViewer";
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
    <section aria-label="Student health records">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Health Records</h2>
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
                aria-label="Search health records"
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
