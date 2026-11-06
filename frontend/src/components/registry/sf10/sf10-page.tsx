"use client";
import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Archive,
  Files,
  FolderOpen,
  Paperclip,
  Search,
  SearchX,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard, KanbanBoardHeader } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { RecordKeeperEmptyState } from "@/app/record-keeper/components/RecordKeeperEmptyCard";
import { Sf10UploadRail } from "@/app/record-keeper/sf10/components/Sf10UploadRail";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { Pagination } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";
import { fetchSf10Records } from "@/services/registry/sf10.service";
import { Sf10FolderGrid, Sf10RecordKanbanGrid } from "@/components/registry/sf10/sf10-folders";
import { Sf10RecordOverlay } from "@/components/registry/sf10/Sf10RecordOverlay";
import {
  type Sf10Record,
  type Sf10Status,
} from "@/services/registry/sf10.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/components/registry/sf10/sf10.module.css";
const STATUS_FILTERS: { key: Sf10Status | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attach", label: "Attached" },
  { key: "released", label: "Released" },
];
// Amber pill tabs — SF10's desk accent (soft chip when idle, solid when
// active). Shared by the record-keeper board header and the registrar list.
const PILL_BASE = "h-7 rounded-full px-3 text-xs";
const PILL_ACTIVE =
  "border-amber-500/60 bg-amber-500 font-semibold text-black hover:bg-amber-400";
const PILL_IDLE =
  "border-amber-500/40 bg-amber-500/10 font-medium text-amber-700 hover:border-amber-500/60 hover:bg-amber-500/20 hover:text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400 dark:hover:bg-amber-500/25 dark:hover:text-amber-300";
export function Sf10Page({
  desk,
  pageSize,
}: {
  desk: "registrar" | "record-keeper";
  pageSize: number;
}) {
  const [openRecordId, setOpenRecordId] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const query = useDebouncedValue(queryInput.trim(), 300);
  const [status, setStatusState] = React.useState<Sf10Status | "all">(
    (searchParams.get("status") as Sf10Status | null) ?? "all",
  );
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q", "status"] });
  const page = pager.page;
  const setPage = pager.setPage;
  const setStatus = React.useCallback(
    (value: Sf10Status | "all") => {
      setStatusState(value);
      pager.setFilters({ status: value === "all" ? undefined : value });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Sync debounced search to the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    pager.setFilters({ q: query || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  const openRecord = (r: Sf10Record) => {
    setOpenRecordId(r.id);
  };
  const EmptyState = RecordKeeperEmptyState;
  const { data, isPending, isError } = useQuery({
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
  // KPI strip (record-keeper) — kanban columns mirroring the desk overview
  // stats board (KanbanBoardHeader + number-first stat card with mascot
  // chip). Mascots are deliberately distinct from the other desk boards'
  // cast (overview owl/scout/knight/postbot, final-grades scientist/rocket/
  // cap, adviser-access glasses/panda/raccoon/robot).
  const kpiColumns = [
    {
      key: "attach",
      icon: Paperclip,
      accent: "text-amber-500",
      title: "Attached",
      value: counts.attach,
      hint: "Uploaded files, stored as-is",
      mascot: "hamster",
    },
    {
      key: "released",
      icon: Archive,
      accent: "text-emerald-600 dark:text-emerald-400",
      title: "Released",
      value: counts.released,
      hint: "Released and archived",
      mascot: "drone",
    },
    {
      key: "total",
      icon: Files,
      accent: "text-blue-500",
      title: "Total records",
      value: counts.total,
      hint: "SF10 files filed by this desk",
      mascot: "lantern",
    },
  ];
  const filteredTotal = data?.total ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(page, totalPages);
  const filtering = query.length > 0 || status !== "all";
  // Both desks now share the record-keeper board layout (KPI kanban board +
  // records board + icon-only upload rail). Scope (grades) is enforced by the
  // backend per desk; the UI is identical.
  const recordKeeper = true;
  const deskLabel = desk === "registrar" ? "registrar" : "record keeper";
  if (!isPending && !isError && counts.total === 0) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyWrap}>
          <div className={styles.emptyStack}>
            <section className={`${assign.card} ${styles.emptyCard}`} aria-label="No SF10 records">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <EmptyState
                icon={FolderOpen}
                title="No SF10 records yet"
                hint={`Upload a file to attach the first SF10 record filed by the ${deskLabel}.`}
              />
              <div className="relative mt-3 flex justify-center">
                <Button asChild size="sm">
                  <Link href={`/${desk}/sf10/upload`}>
                    <Upload aria-hidden />
                    Upload SF10
                  </Link>
                </Button>
              </div>
            </section>
          </div>
        </div>
      </section>
    );
  }
  // Records section copy + controls, shared by both desk layouts: the
  // record keeper renders them inside the kanban board shell (title,
  // description, actions, status filter toolbar), the registrar keeps the
  // classic list head + folder grid. The board variant drops the Upload
  // button (the rail owns upload there) and rounds the search to 16px.
  const recordsDescription = `Learner SF10 files filed by the ${deskLabel} — ${
    isPending ? "…" : `${filteredTotal} shown`
  }.`;
  const recordsActions = (variant: "board" | "head") => {
    const board = variant === "board";
    return (
      <div className={styles.headerActions}>
        {!board && (
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link href={`/${desk}/sf10/upload`}>
              <Upload aria-hidden />
              Upload
            </Link>
          </Button>
        )}
        <div className={styles.searchWrap}>
          <Search className={styles.searchIcon} aria-hidden />
          <Input
            className={board ? `${styles.search} rounded-[16px]` : styles.search}
            placeholder="Search name, LRN, or section…"
            value={queryInput}
            onChange={(e) => {
              setQueryInput(e.target.value);
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
            }}
          >
            <X aria-hidden />
            Show all
          </Button>
        )}
      </div>
    );
  };
  const recordsFilters = (
    <div className={`${styles.filterRow} relative`} role="group" aria-label="Filter by status">
      {STATUS_FILTERS.map((f) => (
        <Button
          key={f.key}
          type="button"
          variant={status === f.key ? "default" : "outline"}
          size="sm"
          className={`${PILL_BASE} ${status === f.key ? PILL_ACTIVE : PILL_IDLE}`}
          onClick={() => {
            setStatus(f.key);
          }}
          aria-pressed={status === f.key}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
  return (
    <section className={recordKeeper ? styles.pageRailed : styles.page}>
      <div className={styles.stack}>
        {recordKeeper ? (
          <section
            className={styles.kpiBoard}
            aria-label="SF10 summary"
            aria-busy={isPending || undefined}
          >
            <div className={styles.kpiGrid}>
              {isPending
                ? Array.from({ length: kpiColumns.length }).map((_, i) => (
                    <div key={i} className={styles.kpiColumn} aria-hidden="true">
                      <div className={styles.kpiHeadSkeleton}>
                        <Skeleton className={styles.kpiSkelTitle} />
                      </div>
                      <Skeleton className={styles.kpiSkelCard} />
                    </div>
                  ))
                : kpiColumns.map((column) => {
                    const Icon = column.icon;
                    return (
                      <div
                        key={column.key}
                        className={styles.kpiColumn}
                        aria-label={`${column.title}, ${column.value}`}
                      >
                        <KanbanBoardHeader
                          icon={<Icon size={14} className={column.accent} aria-hidden />}
                          title={column.title}
                        />
                        <div className={styles.kpiStat}>
                          <span className={styles.kpiStatTop}>
                            <span
                              className={`${styles.kpiNumber} ${
                                column.value === 0 ? styles.kpiNumberZero : ""
                              }`}
                            >
                              {column.value}
                            </span>
                            <span className={styles.kpiMascot} aria-hidden="true">
                              <StudentMascot
                                name={column.title}
                                character={column.mascot}
                                size={36}
                              />
                            </span>
                          </span>
                          <span className={styles.kpiHint}>{column.hint}</span>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </section>
        ) : (
          <section className={assign.card} aria-label="SF10 summary">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            {isPending ? (
              <ul className={`${styles.tiles} relative`}>
                {Array.from({ length: 3 }).map((_, i) => (
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
                  <span className={styles.tileHint}>Uploaded files, stored as-is</span>
                </li>
                <li className={styles.tile}>
                  <span className={styles.tileValue}>{counts.released}</span>
                  <span className={styles.tileLabel}>Released</span>
                  <span className={styles.tileHint}>Released and archived</span>
                </li>
                <li className={styles.tile}>
                  <span className={styles.tileValue}>{counts.total}</span>
                  <span className={styles.tileLabel}>Total records</span>
                  <span className={styles.tileHint}>SF10 files filed by this desk</span>
                </li>
              </ul>
            )}
          </section>
        )}
        {recordKeeper ? (
          <KanbanBoard
            title="SF10 Records"
            icon={<FolderOpen size={14} className="text-amber-500" aria-hidden />}
            description={recordsDescription}
            ariaLabel="SF10 Records"
            actions={recordsActions("board")}
            headerCenter={recordsFilters}
            footer={
              filteredTotal > pageSize ? (
                <Pagination
                  currentPage={safePage}
                  totalItems={filteredTotal}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              ) : undefined
            }
          >
            {isPending ? (
              <div className={styles.folderKanbanGrid} aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className={styles.folderKanbanSkel} />
                ))}
              </div>
            ) : isError ? (
              <p className={styles.empty}>Could not load SF10 records.</p>
            ) : filtering && pageRows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No matching records"
                hint="No SF10 records match the current search or filter."
              />
            ) : (
              // Keyed by page/filter/search so every pagination or filter
              // swap remounts the grid and replays the slow-mo card cascade
              // (even when the result set is identical, e.g. All → Attached).
              <Sf10RecordKanbanGrid
                key={`${desk}-${safePage}-${status}-${query}`}
                records={pageRows}
                onOpen={openRecord}
              />
            )}
          </KanbanBoard>
        ) : (
          <section aria-labelledby="sf10-records">
            <div className={`${styles.listHead} relative`}>
              <div className={styles.listHeadText}>
                <h2 id="sf10-records" className="text-base font-semibold">
                  SF10 Records
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{recordsDescription}</p>
              </div>
              {recordsActions("head")}
            </div>
            {recordsFilters}
            <div className={`${styles.content} relative`}>
              {isPending ? (
                <div className={styles.folderGrid} aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 w-full rounded-xl" />
                  ))}
                </div>
              ) : isError ? (
                <p className={styles.empty}>Could not load SF10 records.</p>
              ) : filtering && pageRows.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No matching records"
                  hint="No SF10 records match the current search or filter."
                />
              ) : (
                <Sf10FolderGrid records={pageRows} onOpen={openRecord} />
              )}
            </div>
            {filteredTotal > pageSize && (
              <Pagination
                currentPage={safePage}
                totalItems={filteredTotal}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            )}
          </section>
        )}
      </div>
      {recordKeeper && <Sf10UploadRail desk={desk} />}
      <Sf10RecordOverlay
        desk={desk}
        recordId={openRecordId}
        onClose={() => setOpenRecordId(null)}
      />
    </section>
  );
}
