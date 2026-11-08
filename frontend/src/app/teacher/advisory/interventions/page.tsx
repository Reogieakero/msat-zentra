"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { HeartHandshake, Search } from "lucide-react";
import { TeacherEmptyCard } from "../../components/TeacherEmptyCard";
import { InsightCallout } from "@/components/ui/insight-callout";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useNowTick } from "@/lib/clock";
import { useTerm } from "@/lib/term/TermContext";
import {
  ADVISORY_INTERVENTIONS_PAGE_SIZE,
  useAdvisoryInterventionsQueue,
  type AdvisoryInterventionFactor,
  type AdvisoryInterventionLevel,
  type AdvisoryInterventionOutcome,
  type AdvisoryInterventionRow,
} from "@/services/teacher/interventions.service";
import { FilterTabs } from "./components/filter-tabs";
import { InterventionRowCard } from "./components/intervention-row";
import { InterventionDetailOverlay } from "./components/intervention-detail-overlay";
import styles from "./components/interventions.module.css";

type LevelFilter = "all" | AdvisoryInterventionLevel;
type FactorFilter = "all" | AdvisoryInterventionFactor;
type OutcomeFilter = "all" | AdvisoryInterventionOutcome;

const LEVEL_VALUES: LevelFilter[] = ["all", "High", "Moderate"];
const FACTOR_VALUES: FactorFilter[] = ["all", "academic", "attendance", "behavioral"];
const OUTCOME_VALUES: OutcomeFilter[] = ["all", "ongoing", "resolved", "unresolved", "none"];

const LEVEL_LABELS: Record<LevelFilter, string> = {
  all: "All at-risk",
  High: "High risk",
  Moderate: "Moderate risk",
  Low: "Low risk",
};
const FACTOR_LABELS: Record<FactorFilter, string> = {
  all: "All factors",
  academic: "Academic",
  attendance: "Attendance",
  behavioral: "Behavioral",
};
const OUTCOME_LABELS: Record<OutcomeFilter, string> = {
  all: "All states",
  ongoing: "Ongoing",
  resolved: "Resolved",
  unresolved: "Unresolved",
  none: "No plan yet",
};

const LEVEL_OPTIONS = LEVEL_VALUES.map((value) => ({ value, label: LEVEL_LABELS[value] }));
const FACTOR_OPTIONS = FACTOR_VALUES.map((value) => ({ value, label: FACTOR_LABELS[value] }));
const OUTCOME_OPTIONS = OUTCOME_VALUES.map((value) => ({ value, label: OUTCOME_LABELS[value] }));

// Same ordering the backend applies: risk level, then flag count, then name.
const LEVEL_RANK: Record<string, number> = { High: 0, Moderate: 1, Low: 2 };

function isOneOf<T extends string>(value: string | null, options: readonly T[]): value is T {
  return value !== null && (options as readonly string[]).includes(value);
}

function AdviserInterventionsPageInner() {
  const searchParams = useSearchParams();
  const now = useNowTick();
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  // Filters live in local state so search and tabs filter the loaded board
  // instantly — same behaviour as the guidance interventions desk.
  const [queryInput, setQueryInput] = React.useState(() => searchParams.get("q") ?? "");
  const [level, setLevelState] = React.useState<LevelFilter>(() => {
    const value = searchParams.get("level");
    return isOneOf(value, LEVEL_VALUES) ? value : "all";
  });
  const [factor, setFactorState] = React.useState<FactorFilter>(() => {
    const value = searchParams.get("factor");
    return isOneOf(value, FACTOR_VALUES) ? value : "all";
  });
  const [outcome, setOutcomeState] = React.useState<OutcomeFilter>(() => {
    const value = searchParams.get("outcome");
    return isOneOf(value, OUTCOME_VALUES) ? value : "all";
  });
  const [sectionId, setSectionIdState] = React.useState<string>(() => searchParams.get("section") ?? "all");

  const query = useAdvisoryInterventionsQueue(termKey, termReady);
  const allRows = React.useMemo(() => query.data?.data ?? [], [query.data]);
  const sections = query.data?.sections ?? [];

  const filtered = React.useMemo(() => {
    const needle = queryInput.trim().toLowerCase();
    return allRows
      .filter((row) => {
        if (sectionId !== "all" && row.sectionId !== sectionId) return false;
        if (level !== "all" && row.riskLevel !== level) return false;
        if (factor !== "all" && !row.factors[factor]) return false;
        if (outcome === "none" && row.intervention) return false;
        if (
          outcome !== "all" &&
          outcome !== "none" &&
          row.intervention?.outcomeStatus !== outcome
        ) {
          return false;
        }
        if (needle && !`${row.name} ${row.lrn} ${row.section}`.toLowerCase().includes(needle)) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (LEVEL_RANK[a.riskLevel] ?? 9) - (LEVEL_RANK[b.riskLevel] ?? 9) ||
          b.riskCount - a.riskCount ||
          a.name.localeCompare(b.name),
      );
  }, [allRows, sectionId, level, factor, outcome, queryInput]);

  const pager = useUrlPager(filtered.length, {}, {
    searchParam: "q",
    extraParams: ["q", "level", "factor", "outcome", "section"],
    pageSize: ADVISORY_INTERVENTIONS_PAGE_SIZE,
  });
  const page = pager.page;
  const setPage = pager.setPage;

  const totalPages = Math.max(1, Math.ceil(filtered.length / ADVISORY_INTERVENTIONS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * ADVISORY_INTERVENTIONS_PAGE_SIZE,
    safePage * ADVISORY_INTERVENTIONS_PAGE_SIZE,
  );

  const handleQueryChange = (value: string) => {
    setQueryInput(value);
    // Local filtering is instant — only reset the pager, and skip the URL
    // write while already on page 1 so typing never triggers router churn.
    if (page !== 1) setPage(1);
  };

  const setLevel = (value: LevelFilter) => {
    setLevelState(value);
    pager.setFilters({ level: value === "all" ? undefined : value });
  };
  const setFactor = (value: FactorFilter) => {
    setFactorState(value);
    pager.setFilters({ factor: value === "all" ? undefined : value });
  };
  const setOutcome = (value: OutcomeFilter) => {
    setOutcomeState(value);
    pager.setFilters({ outcome: value === "all" ? undefined : value });
  };
  const setSection = (value: string) => {
    setSectionIdState(value);
    pager.setFilters({ section: value === "all" ? undefined : value });
  };

  const sectionOptions = React.useMemo(
    () => [
      { value: "all", label: "All sections" },
      ...sections.map((section) => ({ value: section.id, label: section.name })),
    ],
    [sections],
  );

  const [selected, setSelected] = React.useState<AdvisoryInterventionRow | null>(null);
  // Keep the open overlay fresh after a refetch.
  const selectedRow = selected
    ? allRows.find((row) => row.key === selected.key) ?? selected
    : null;

  const hasActiveFilters =
    queryInput.trim() !== "" ||
    level !== "all" ||
    factor !== "all" ||
    outcome !== "all" ||
    sectionId !== "all";

  const levelNoun =
    level === "High"
      ? "high-risk advisee"
      : level === "Moderate"
        ? "moderate-risk advisee"
        : level === "Low"
          ? "low-risk advisee"
          : "at-risk advisee";

  if (query.isPending && !query.data) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading interventions">
        <div className="flex flex-col gap-2 rounded-xl border border-border p-2.5">
          <div className="relative -mx-2.5 flex items-center gap-2 border-b border-border px-3.5 pb-2">
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
              <Skeleton className="size-3.5 shrink-0 rounded" />
              <Skeleton className="h-3.5 w-32" />
            </span>
            <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center">
              <Skeleton className="h-6 w-56 rounded-md" />
            </div>
            <span className="flex shrink-0 items-center justify-end gap-2">
              <Skeleton className="h-8 w-64 max-w-full rounded-2xl" />
            </span>
          </div>
          <div className="px-1">
            <Skeleton className="h-3 w-72 max-w-[90%]" />
          </div>
          <div className={styles.caseList}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((card) => (
              <div key={card} className={styles.skelCaseRow}>
                <div className="flex items-center gap-2">
                  <Skeleton className={styles.skelAvatar} />
                  <div className={styles.skelCaseLines}>
                    <Skeleton className={styles.skelBar} style={{ width: "60%" }} />
                    <div className="flex flex-wrap gap-1">
                      <Skeleton className={styles.skelPill} />
                      <Skeleton className={styles.skelPill} style={{ width: "2.75rem" }} />
                    </div>
                  </div>
                  <Skeleton className={styles.skelPill} style={{ width: "3.5rem" }} />
                </div>
                <div className="mt-6 flex flex-wrap gap-1.5">
                  <Skeleton className={styles.skelPill} style={{ width: "5rem" }} />
                  <Skeleton className={styles.skelPill} style={{ width: "4rem" }} />
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-2">
                  <Skeleton className={styles.skelPill} style={{ width: "4rem" }} />
                  <Skeleton className={styles.skelPill} style={{ width: "3.5rem" }} />
                </div>
              </div>
            ))}
          </div>
          <div className={styles.skelPager}>
            <Skeleton className={styles.skelRange} />
            <div className={styles.skelPagerBtns}>
              <Skeleton className={styles.skelPageBtn} />
              <Skeleton className={styles.skelPageLabel} />
              <Skeleton className={styles.skelPageBtn} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (query.isError && !query.data) {
    return (
      <TeacherEmptyCard
        centered
        icon={HeartHandshake}
        title="No advisory section assigned"
        hint="Interventions are scoped to your advisory section. Claim your advisory in Settings, then come back."
        label="Advisory interventions"
      />
    );
  }

  return (
    <section className={styles.page} aria-label="Advisory interventions">
      <KanbanBoard
        title="Intervention cases"
        className={styles.boardIn}
        icon={
          <span className="text-amber-600 dark:text-amber-400" aria-hidden>
            <HeartHandshake size={14} />
          </span>
        }
        headerCenter={
          <div className="flex flex-wrap items-center gap-2">
            <FilterTabs
              label="Filter cases by risk level"
              options={LEVEL_OPTIONS}
              value={level}
              onChange={setLevel}
              tone="blue"
            />
            {sections.length > 1 ? (
              <>
                <span className="h-4 w-px bg-border" aria-hidden />
                <FilterTabs
                  label="Filter cases by advisory section"
                  options={sectionOptions}
                  value={sectionId}
                  onChange={setSection}
                  tone="amber"
                />
              </>
            ) : null}
          </div>
        }
        description={
          filtered.length === 0
            ? `No ${levelNoun}s right now`
            : "Risk flags and guidance follow-ups for your advisees this term."
        }
        actions={
          <div className={styles.headerActions}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                style={{ height: "2rem", borderRadius: "16px" }}
                placeholder="Search advisee or LRN…"
                value={queryInput}
                onChange={(event) => handleQueryChange(event.target.value)}
                aria-label="Search advisee or LRN"
              />
            </div>
          </div>
        }
        toolbar={
          <div className="flex flex-wrap items-center justify-center gap-2 px-1">
            <FilterTabs
              label="Filter cases by risk factor"
              options={FACTOR_OPTIONS}
              value={factor}
              onChange={setFactor}
              tone="amber"
            />
            <span className="h-4 w-px bg-border" aria-hidden />
            <FilterTabs
              label="Filter cases by intervention state"
              options={OUTCOME_OPTIONS}
              value={outcome}
              onChange={setOutcome}
              tone="green"
            />
          </div>
        }
        footer={
          filtered.length > 0 ? (
            <Pagination
              currentPage={safePage}
              totalItems={filtered.length}
              pageSize={ADVISORY_INTERVENTIONS_PAGE_SIZE}
              onPageChange={setPage}
            />
          ) : null
        }
      >
        {pageRows.length === 0 ? (
          <div className="flex w-full justify-center py-6">
            <InsightCallout role="status">
              {hasActiveFilters
                ? queryInput.trim()
                  ? `No cases match “${queryInput.trim()}”.`
                  : "No cases match your filters."
                : "No advisees flagged this term. Learners flagged by the risk engine, or with a guidance follow-up, will appear here."}
            </InsightCallout>
          </div>
        ) : (
          <ul className={styles.caseList} aria-label="Intervention cases on the advisory desk">
            {pageRows.map((row, index) => (
              <InterventionRowCard
                key={row.key}
                row={row}
                index={index}
                now={now}
                onOpen={setSelected}
              />
            ))}
          </ul>
        )}
      </KanbanBoard>

      <InterventionDetailOverlay row={selectedRow} onClose={() => setSelected(null)} />
    </section>
  );
}

export default function AdviserInterventionsPage() {
  return (
    <React.Suspense fallback={<div className="flex flex-col gap-4" aria-busy="true" />}>
      <AdviserInterventionsPageInner />
    </React.Suspense>
  );
}
