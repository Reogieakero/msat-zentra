"use client";
import * as React from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderOpen,
  Search,
  SearchX,
  X,
} from "lucide-react";
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
import { Sf10UploadPanel } from "@/components/registry/sf10/Sf10UploadPanel";
import { Sf10DetailSheet as RegistrarDetailSheet } from "@/app/registrar/sf10/components/Sf10DetailSheet";
import { Sf10DetailSheet as RecordKeeperDetailSheet } from "@/app/record-keeper/sf10/components/Sf10DetailSheet";
import { StatusBadge, formatRelativeTime } from "@/components/registry/sf10/shared";
import { toast } from "@/components/ui/sonner";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { fetchSf10Records } from "@/services/registry/sf10.service";
import {
  GRADE_LABEL,
  SF10_SOURCE_LABEL,
  type Sf10Record,
  type Sf10Status,
} from "@/services/registry/sf10.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/components/registry/sf10/sf10.module.css";
const STATUS_FILTERS: { key: Sf10Status | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attach", label: "Attached" },
  { key: "available", label: "Available" },
  { key: "released", label: "Released" },
];
export function Sf10Page({
  desk,
  pageSize,
  gradeRange,
}: {
  desk: "registrar" | "record-keeper";
  pageSize: number;
  gradeRange: string;
}) {
  const qc = useQueryClient();
  const [queryInput, setQueryInput] = React.useState("");
  const query = useDebouncedValue(queryInput.trim(), 300);
  const [status, setStatus] = React.useState<Sf10Status | "all">("all");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Sf10Record | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const {
    data,
    isPending,
    isError,
    isFetching,
  } = useQuery({
    queryKey: [`${desk}-sf10`, page, query, status],
    queryFn: ({ signal }) =>
      fetchSf10Records({
        page,
        pageSize,
        ...(query ? { q: query } : {}),
        ...(status !== "all" ? { status } : {}),
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const pageRows = React.useMemo(() => data?.records ?? [], [data]);
  const counts = React.useMemo(
    () => data?.counts ?? { attach: 0, available: 0, released: 0, total: 0 },
    [data],
  );
  const filteredTotal = data?.total ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = filteredTotal === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, filteredTotal);
  const filtering = query.length > 0 || status !== "all";
  const isSyncing = isFetching && !isPending;
  const openRecord = (r: Sf10Record) => {
    setSelected(r);
    setSheetOpen(true);
  };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: [`${desk}-sf10`] });
    qc.invalidateQueries({ queryKey: [`${desk}-overview`] });
    qc.invalidateQueries({ queryKey: [`${desk}-notifications`] });
  };
  const handleUpload = async () => {
    toast.info({
      title: "Upload paused",
      description: "Learner matching via OCR lands in a future build.",
    });
  };
  const DetailSheet = desk === "registrar" ? RegistrarDetailSheet : RecordKeeperDetailSheet;
  if (!isPending && !isError && counts.total === 0) {
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
                  Upload a file above to attach the first SF10 record for grades {gradeRange}.
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
                <span className={styles.tileHint}>Grades {gradeRange} SF10 files</span>
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
                Learner SF10 files for grades {gradeRange} —{" "}
                {isPending ? "…" : `${filteredTotal} shown${isSyncing ? " · Syncing…" : ""}`}.
              </p>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} aria-hidden />
                <Input
                  className={styles.search}
                  placeholder="Search name, LRN, or section…"
                  value={queryInput}
                  onChange={(e) => {
                    setQueryInput(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Search SF10 records"
                />
              </div>
              {queryInput && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.clearBtn}
                  onClick={() => {
                    setQueryInput("");
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
                    {Array.from({ length: pageSize }).map((_, i) => (
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
            ) : filtering && pageRows.length === 0 ? (
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
          {filteredTotal > 0 && (
            <div className={`${styles.footer} relative`}>
              <p className={styles.footerInfo}>
                Showing {filteredTotal > 0 ? `${start}–${end}` : "0"} of {filteredTotal}
              </p>
              <div className={styles.footerActions}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={safePage <= 1 || filteredTotal === 0}
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
                  disabled={safePage >= totalPages || filteredTotal === 0}
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
      <DetailSheet
        record={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChanged={refresh}
      />
    </section>
  );
}
