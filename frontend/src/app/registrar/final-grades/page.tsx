"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Search,
  Eye,
  GraduationCap,
  FileSignature,
  FolderCheck,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatGrade, formatSection } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightCallout } from "@/components/ui/insight-callout";
import { KanbanBoard, KanbanBoardHeader } from "@/components/ui/kanban-board";
import { RowList, type RowListItem } from "@/components/ui/row-list";
import { RowListSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import styles from "./final-grades.module.css";
import { RegistrarEmptyState } from "../components/RegistrarEmptyCard";
import { PipelineRail } from "@/components/registry/final-grades/PipelineRail";
import {
  FinalGradeSetDialog,
  type GradeSetStudent,
} from "@/components/registry/final-grades/FinalGradeSetDialog";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";

interface GradesResponse {
  students: GradeSetStudent[];
  total: number;
  ready: number;
  complete: number;
  locked: number;
  page: number;
  pageSize: number;
}

export default function FinalGradeApprovalsPage() {
  return (
    <React.Suspense>
      <FinalGradeApprovalsPageInner />
    </React.Suspense>
  );
}

function FinalGradeApprovalsPageInner() {
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  // Row whose kanban board dialog is open (eye action). Null = closed.
  const [selected, setSelected] = React.useState<GradeSetStudent | null>(null);
  // Read the URL page directly so the query key changes on navigation.
  const rawPage = React.useMemo(() => {
    const raw = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  }, [searchParams]);
  // Debounced server search, with the loaded page also filtered instantly as
  // the user types (same feel as the nurse alerts board) so results respond on
  // every keystroke before the server round-trip swaps in the full match set.
  const query = useDebouncedValue(queryInput.trim(), 300);
  const debouncedQuery = query;

  const setQuery = React.useCallback((value: string) => {
    setQueryInput(value);
  }, []);

  const { data, isPending, isError } = useQuery<GradesResponse>({
    queryKey: ["registrar-final-grades", rawPage, debouncedQuery],
    queryFn: ({ signal }) =>
      apiClient
        .get<GradesResponse>("/api/registrar/final-grades", {
          params: {
            page: rawPage,
            pageSize: PAGE_SIZE,
            ...(debouncedQuery ? { q: debouncedQuery } : {}),
          },
          signal,
        })
        .then((res) => res.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const stats = {
    ready: data?.ready ?? 0,
    complete: data?.complete ?? 0,
    total: data?.complete ?? 0,
  };

  // KPI strip — kanban columns mirroring the registrar overview stats board
  // (KanbanBoardHeader + number-first stat card with mascot chip). Mascots
  // are deliberately distinct from the overview board's cast (owl / scout /
  // knight / postbot).
  const kpiColumns = [
    {
      key: "ready",
      icon: FileSignature,
      accent: "text-primary",
      title: "Ready subjects",
      value: stats.ready,
      hint: "Adviser-approved final grades, viewable",
      mascot: "scientist",
    },
    {
      key: "complete",
      icon: FolderCheck,
      accent: "text-emerald-600 dark:text-emerald-400",
      title: "Complete sets",
      value: stats.complete,
      hint: "Students with a fully approved term",
      mascot: "rocket",
    },
    {
      key: "total",
      icon: GraduationCap,
      accent: "text-blue-500",
      title: "Total students",
      value: stats.total,
      hint: "Fully approved student-terms in G11–12",
      mascot: "cap",
    },
  ];

  const pageRows = React.useMemo(() => data?.students ?? [], [data]);
  const filteredTotal = data?.total ?? pageRows.length;

  // Instant local filter of the loaded page while the debounced server query
  // catches up — matches the nurse alerts board's typing feel.
  const visibleRows = React.useMemo(() => {
    const q = queryInput.trim().toLowerCase();
    if (!q) return pageRows;
    return pageRows.filter((s) =>
      `${s.name} ${s.lrn} ${s.section} ${s.subjects.map((sub) => sub.code).join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [pageRows, queryInput]);

  // Kanban rows — term chip + status pill on the left, mascot + name
  // (their stored sprite, same as the adviser lists), LRN pill, then
  // subject code(s) / grade level / section / average pills and the
  // per-row view action.
  const rowItems = React.useMemo<RowListItem[]>(
    () =>
      visibleRows.map((s) => ({
        key: s.id,
        leadPill: { label: s.term, tone: "amber" },
        status: { label: "Complete", tone: "green" },
        title: s.name,
        idLabel: s.lrn,
        meta: [
          // One pill per subject code in the set (deduped; backend returns
          // subjects in name order). A single-subject set renders one code
          // pill. Subject code / grade level / section wear the amber chip;
          // the overall average stays muted.
          ...[...new Set(s.subjects.map((sub) => sub.code))].map((code) => ({
            label: code,
            tone: "amber" as const,
            dot: false,
            title: `Subject code: ${code}`,
          })),
          { label: formatGrade(s.gradeLevel), tone: "amber", dot: false },
          { label: formatSection(s.section), tone: "amber", dot: false },
          { label: `Overall ${s.overall}`, tone: "muted", dot: false },
        ],
        ariaLabel: `${s.name}, complete term, overall average ${s.overall}`,
        avatarMascot: { name: s.name, seed: s.lrn, character: s.mascot ?? undefined },
        actions: (
          <Button
            variant="ghost"
            className="h-6 w-6 shrink-0 px-0"
            aria-label={`View grade details for ${s.name}`}
            title="View final grade set"
            onClick={() => setSelected(s)}
          >
            <Eye size={14} strokeWidth={1.8} aria-hidden />
          </Button>
        ),
      })),
    [visibleRows]
  );

  // Pager gets the live total so it can clamp out-of-range pages and drive
  // the <Pagination /> highlight. Data fetching uses rawPage above to avoid
  // a page <-> total circular dependency.
  const pager = useUrlPager(filteredTotal, {}, { searchParam: "q", extraParams: ["q"] });
  const setPage = pager.setPage;
  const safePage = pager.page;

  // Sync debounced search to the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    pager.setFilters({ q: debouncedQuery || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);
  const hasRecords = (data?.complete ?? 0) > 0;
  const searching = queryInput.trim().length > 0;
  // True empty (no records at all, not a search with no matches):
  // hide the KPI board and table card entirely and render a single centered
  // card instead.
  const isTrueEmpty = !isPending && !isError && !hasRecords && !searching;

  if (isTrueEmpty) {
    return (
      <section className={`${styles.page} ${styles.pageEmpty}`}>
        <div className={styles.emptyBoard}>
          <KanbanBoard
            title="Final Grade Approvals"
            icon={<FileSignature size={14} className="text-primary" aria-hidden />}
            description="One row per student with a complete term — every subject locked or adviser-approved."
            ariaLabel="Final grade approvals"
          >
            <RegistrarEmptyState
              icon={GraduationCap}
              title="No complete grade sets yet"
              hint="Students appear once every subject is locked or adviser-approved."
            />
          </KanbanBoard>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        <section
          className={styles.kpiBoard}
          aria-label="Final grades summary"
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
                            <StudentMascot name={column.title} character={column.mascot} size={36} />
                          </span>
                        </span>
                        <span className={styles.kpiHint}>{column.hint}</span>
                      </div>
                    </div>
                  );
                })}
          </div>
        </section>

        <KanbanBoard
          title="Final Grade Approvals"
          icon={<FileSignature size={14} className="text-primary" aria-hidden />}
          description="One row per student with a complete term — every subject locked or adviser-approved."
          ariaLabel="Final grade approvals"
          actions={
            <div className={styles.headerActions}>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} aria-hidden />
                <Input
                  className={styles.search}
                  placeholder="Search name, LRN, or subject…"
                  value={queryInput}
                  onChange={(e) => {
                    setQuery(e.target.value);
                  }}
                  aria-label="Search final grades"
                />
              </div>
            </div>
          }
          footer={
            <Pagination
              currentPage={safePage}
              totalItems={filteredTotal}
              onPageChange={setPage}
            />
          }
        >
          {isPending ? (
            <RowListSkeleton
              hasLead
              rows={6}
              gutter="0.625rem"
              withMetaAvatar={false}
              withActions
              metaPills={3}
            />
          ) : isError ? (
            <p className={styles.empty}>Could not load final grades.</p>
          ) : !hasRecords ? (
            <RegistrarEmptyState
              icon={GraduationCap}
              title="No complete grade sets yet"
              hint="Students appear once every subject is locked or adviser-approved."
            />
          ) : searching && visibleRows.length === 0 ? (
            <div className="flex w-full justify-center py-6">
              <InsightCallout role="status" className="w-full max-w-xl text-left">
                <strong>No complete grade sets match &ldquo;{queryInput.trim()}&rdquo;.</strong>{" "}
                Try a different name, LRN, or subject code.
              </InsightCallout>
            </div>
          ) : (
            <RowList
              bleed
              gutter="0.625rem"
              animateOnMount
              items={rowItems}
              emptyText="No complete grade sets yet."
              ariaLabel="Final grade approvals"
            />
          )}
        </KanbanBoard>
      </div>

      <PipelineRail
        desk="registrar"
        counts={{
          locked: data?.locked,
          complete: data?.complete,
        }}
        isLoading={isPending}
        isError={isError}
      />

      {/* Keyed by row so the About toggle resets between students. */}
      <FinalGradeSetDialog
        key={selected?.id ?? "closed"}
        desk="registrar"
        student={selected}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}
