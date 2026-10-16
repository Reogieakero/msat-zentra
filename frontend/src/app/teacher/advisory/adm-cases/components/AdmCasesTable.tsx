"use client";

import * as React from "react";
import { Loader2, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { ZentraFilterBarSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import ovStyles from "@/app/teacher/overview/components/teacher-overview-advisory.module.css";
import { Pagination } from "@/components/shared/pagination";
import type { AdmCase } from "@/services/teacher/admCases.types";
import { stageColor } from "@/services/teacher/admCases.labels";
import { AdmCaseCard } from "./AdmCaseCard";
import { AdmStarterKanban } from "./AdmEmptyKanban";
import { AdmStarterSidebar } from "./AdmStarterSidebar";
import refStyles from "../../referrals/components/referrals.module.css";

function formatPreparedDate(iso: string | null): string {
  if (!iso) return "Undated";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Column tint follows the case's current pipeline stage. */
function caseDot(c: AdmCase): string {
  return stageColor(c.stage);
}

export function AdmCasesTable({
  cases,
  total,
  unfilteredTotal,
  query,
  onQueryChange,
  highlightId,
  casesQuery,
  onDetails,
  onReferAdm,
  currentPage,
  onPageChange,
}: {
  cases: AdmCase[];
  total: number;
  unfilteredTotal: number;
  query: string;
  onQueryChange: (v: string) => void;
  highlightId: string | null;
  casesQuery: { isPending: boolean; isError: boolean; isFetching: boolean; refetch: () => void };
  onDetails: (c: AdmCase) => void;
  onReferAdm: () => void;
  currentPage: number;
  onPageChange: (p: number) => void;
}) {
  // Newest case first (today on top), one kanban column per ADM
  // referral — cases never stack, each referral owns its column.
  const sorted = React.useMemo(() => {
    const ts = (v: string | null) => {
      if (!v) return 0;
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    return [...cases].sort((a, b) => ts(b.datePrepared) - ts(a.datePrepared));
  }, [cases]);
  // Background refetches keep the current list on screen and patch it in
  // place — skeletons only run on the very first load, so the page never
  // visibly refreshes while paging or searching.
  const isPageLoading =
    casesQuery.isFetching && !casesQuery.isPending && cases.length === 0;
  if (casesQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading ADM cases">
        <ZentraFilterBarSkeleton selects={1} />
        <ZentraTableSkeleton rows={8} columns={5} />
      </div>
    );
  }
  if (casesQuery.isError) {
    return (
      <div className={assign.card}>
        <span className={assign.glowClip} aria-hidden="true">
          <span className={assign.cardGlow} />
        </span>
        <div className="relative flex flex-col items-center gap-2 py-6 text-center">
          <p role="alert" className="font-medium">
            Could not load your ADM cases.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => casesQuery.refetch()}
            disabled={casesQuery.isFetching}
          >
            {casesQuery.isFetching ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden />
                <span aria-live="polite">Retrying</span>
              </>
            ) : (
              "Try again"
            )}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4" aria-busy={isPageLoading || undefined}>
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={ovStyles.sectionTitle}>ADM Cases</h2>
              <p className={ovStyles.sectionDesc}>
                Your referred ADM cases — {total} case
                {total === 1 ? "" : "s"}
                {unfilteredTotal !== total ? ` (of ${unfilteredTotal} total)` : ""}.
              </p>
            </div>
            <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">
              <InputGroup className="max-w-40 shrink-0 rounded-[16px]">
                <InputGroupInput
                  placeholder="Filter ADM cases..."
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  aria-label="Filter ADM cases"
                />
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
              </InputGroup>
            </div>
          </div>
          {isPageLoading ? (
            <div className="relative" aria-hidden>
              <ul className={refStyles.recordGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={`skeleton-${i}`} className="flex min-w-0">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border p-2.5">
                      <div className="h-4 w-2/3 rounded bg-muted" />
                      <div className="h-20 w-full rounded bg-muted" />
                      <div className="h-4 w-1/2 rounded bg-muted" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : sorted.length > 0 ? (
            <ul className={`relative ${refStyles.recordGrid}`}>
              {sorted.map((c) => {
                const dot = caseDot(c);
                const date = formatPreparedDate(c.datePrepared);
                const highlighted =
                  highlightId !== null &&
                  (highlightId === c.id || highlightId === c.referralId);
                return (
                  <li key={c.id} className="flex min-w-0">
                    <article
                      aria-label={`ADM case for ${c.studentName} prepared ${date}`}
                      style={{
                        borderColor: `color-mix(in srgb, ${dot} 40%, transparent)`,
                        backgroundColor: `color-mix(in srgb, ${dot} 12%, transparent)`,
                      }}
                      className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border p-2.5 [font-family:var(--font-inter)]"
                    >
                      <div
                        style={{
                          borderColor: `color-mix(in srgb, ${dot} 30%, transparent)`,
                        }}
                        className="-mx-2.5 flex min-w-0 items-center gap-1.5 border-b px-3.5 pb-2"
                      >
                        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: dot }}
                            aria-hidden
                          />
                          <span className="truncate" title={date}>
                            {date}
                          </span>
                        </span>
                        <span
                          className="inline-flex min-w-0 max-w-[50%] shrink-0 items-center truncate rounded-md border px-2 py-0.5 text-[10px] font-semibold leading-tight"
                          style={{
                            color: dot,
                            borderColor: `color-mix(in srgb, ${dot} 40%, transparent)`,
                            backgroundColor: `color-mix(in srgb, ${dot} 12%, transparent)`,
                          }}
                          title={c.stageLabel}
                        >
                          {c.stageLabel}
                        </span>
                      </div>
                      <div
                        id={highlighted ? `teacher-adm-case-${highlightId}` : undefined}
                        data-highlighted={highlighted || undefined}
                        className={highlighted ? "rounded-md ring-2 ring-amber-500" : undefined}
                      >
                        <AdmCaseCard caseData={c} onDetails={() => onDetails(c)} />
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="relative py-8 text-center text-sm text-muted-foreground">
              No ADM cases match your search.
            </p>
          )}
          <Pagination
            currentPage={currentPage}
            totalItems={total}
            onPageChange={(p) => onPageChange(p)}
          />
        </div>
        {!isPageLoading && sorted.length > 0 ? (
          <AdmStarterSidebar onReferAdm={onReferAdm} />
        ) : null}
      </div>
      <div className="mt-auto border-t border-border pt-4 lg:hidden" aria-label="ADM starter actions">
        <AdmStarterKanban singleRow onReferAdm={onReferAdm} />
      </div>
    </div>
  );
}
