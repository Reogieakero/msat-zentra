"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderOpen,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatSection } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Sf10UploadPanel } from "./components/Sf10UploadPanel";
import { Sf10DetailSheet } from "./components/Sf10DetailSheet";
import { StatusBadge, formatRelativeTime } from "./components/shared";
import { toast } from "@/components/ui/sonner";
import { fetchSf10Records } from "./api";
import {
  GRADE_LABEL,
  SF10_SOURCE_LABEL,
  type Sf10Record,
  type Sf10Status,
} from "./types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./sf10.module.css";

const PAGE_SIZE = 10;
const STATUS_FILTERS: { key: Sf10Status | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attach", label: "Attached" },
  { key: "available", label: "Available" },
  { key: "released", label: "Released" },
];

export default function RecordKeeperSf10Page() {
  const qc = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<Sf10Status | "all">("all");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Sf10Record | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const {
    data: records,
    isPending,
    isError,
  } = useQuery({
    // Record-keeper-scoped key so the realtime channel refreshes this list live.
    queryKey: ["record-keeper-sf10"],
    queryFn: ({ signal }) => fetchSf10Records(signal),
  });

  const all = records ?? [];

  const counts = React.useMemo(() => {
    return {
      attach: all.filter((r) => r.status === "attach").length,
      available: all.filter((r) => r.status === "available").length,
      released: all.filter((r) => r.status === "released").length,
      total: all.length,
    };
  }, [all]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.lrn.toLowerCase().includes(q) ||
        r.section.toLowerCase().includes(q)
      );
    });
  }, [all, query, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);
  const filtering = query.trim().length > 0 || status !== "all";

  const openRecord = (r: Sf10Record) => {
    setSelected(r);
    setSheetOpen(true);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["record-keeper-sf10"] });
    qc.invalidateQueries({ queryKey: ["record-keeper-overview"] });
    qc.invalidateQueries({ queryKey: ["record-keeper-notifications"] });
  };

  // Manual uploads are paused until learner matching via OCR lands —
  // the backend requires a student profile the upload flow can no longer
  // provide, so we acknowledge instead of misattributing the file.
  const handleUpload = async (_file: File) => {
    toast.info({
      title: "Upload paused",
      description: "Learner matching via OCR lands in a future build.",
    });
  };

  if (!isPending && !isError && all.length === 0) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyWrap}>
          <div className={styles.emptyStack}>
            <Sf10UploadPanel onUpload={handleUpload} />
            <section className={`${assign.card} ${styles.emptyCard}`} aria-label="No SF10 records">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className={`${styles.empty} relative`}>
                <span className={styles.emptyIcon} aria-hidden="true">
                  <FolderOpen />
                </span>
                <p className={styles.emptyTitle}>No SF10 records yet</p>
                <p className={styles.emptyHint}>
                  Upload a file above to attach the first SF10 record for grades 7–10.
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>
    );
  }


  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <section className={assign.card} aria-label="SF10 summary">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          {isPending ? (
            <ul className={`${styles.tiles} relative`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className={styles.tileSkel} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className={`${styles.tiles} relative`}>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{counts.attach}</span>
                <span className={styles.tileLabel}>Attached</span>
                <span className={styles.tileHint}>Files pulled in, awaiting validation</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{counts.available}</span>
                <span className={styles.tileLabel}>Available</span>
                <span className={styles.tileHint}>Validated and on hand</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{counts.released}</span>
                <span className={styles.tileLabel}>Released</span>
                <span className={styles.tileHint}>Released and archived</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{counts.total}</span>
                <span className={styles.tileLabel}>Total records</span>
                <span className={styles.tileHint}>Grades 7–10 SF10 files</span>
              </li>
            </ul>
          )}
        </section>

        <Sf10UploadPanel onUpload={handleUpload} />

        <section className={assign.card} aria-labelledby="sf10-records">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className={`${styles.listHead} relative`}>
            <div className={styles.listHeadText}>
              <h2 id="sf10-records" className="text-base font-semibold">
                SF10 Records
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Learner SF10 files for grades 7–10 —{" "}
                {isPending ? "…" : `${filtered.length} shown`}.
              </p>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} aria-hidden />
                <Input
                  className={styles.search}
                  placeholder="Search name, LRN, or section…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Search SF10 records"
                />
              </div>
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.clearBtn}
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                >
                  <X aria-hidden />
                  Show all
                </Button>
              )}
            </div>
          </div>

          <div className={`${styles.filterRow} relative`} role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.key}
                type="button"
                variant={status === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatus(f.key);
                  setPage(1);
                }}
                aria-pressed={status === f.key}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className={`${styles.content} relative`}>
            {isPending ? (
              <div className={styles.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Grade · Section</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className={styles.studentCell}>
                            <Skeleton className={styles.skelName} />
                            <Skeleton className={styles.skelLrn} />
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className={styles.skelCell} style={{ width: "60%" }} /></TableCell>
                        <TableCell><Skeleton className={styles.skelCell} style={{ width: "50%" }} /></TableCell>
                        <TableCell><Skeleton className={styles.skelCell} style={{ width: "50%" }} /></TableCell>
                        <TableCell><Skeleton className={styles.skelCell} style={{ width: "50%" }} /></TableCell>
                        <TableCell><Skeleton className={styles.skelCell} style={{ width: "40%" }} /></TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : isError ? (
              <p className={styles.empty}>Could not load SF10 records.</p>
            ) : filtering && filtered.length === 0 ? (
              <div className={styles.emptyBlock}>
                <span className={styles.emptyIcon} aria-hidden>
                  <SearchX />
                </span>
                <p className={styles.emptyTitle}>No matching records</p>
                <p className={styles.emptyHint}>
                  No SF10 records match the current search or filter.
                </p>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Grade · Section</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => (
                      <TableRow
                        key={r.id}
                        className={styles.clickableRow}
                        onClick={() => openRecord(r)}
                      >
                        <TableCell>
                          <div className={styles.studentCell}>
                            <span className={styles.studentName}>{r.fullName}</span>
                            <span className={styles.studentLrn}>{r.lrn}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={styles.gradeTag}>
                            {GRADE_LABEL[r.gradeLevel] ?? r.gradeLevel} · {r.section}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className={styles.cellMuted}>
                          {SF10_SOURCE_LABEL[r.source]}
                        </TableCell>
                        <TableCell className={styles.cellMuted}>
                          {formatRelativeTime(r.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <span className={styles.versionTag}>v{r.currentVersion}</span>
                        </TableCell>
                        <TableCell className={styles.menuCell}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`View ${r.fullName} SF10 details`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openRecord(r);
                            }}
                          >
                            <Eye aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {filtered.length > 0 && (
            <div className={`${styles.footer} relative`}>
              <p className={styles.footerInfo}>
                Showing {filtered.length > 0 ? `${start}–${end}` : "0"} of {filtered.length}
              </p>
              <div className={styles.footerActions}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1 || filtered.length === 0}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft aria-hidden />
                  Previous
                </Button>
                <span className={styles.pageLabel} aria-live="polite">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage >= totalPages || filtered.length === 0}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <Sf10DetailSheet
        record={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChanged={refresh}
      />
    </section>
  );
}
