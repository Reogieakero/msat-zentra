"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { writeLastViewedReferralId } from "../referrals/last-viewed";
import { AdmCaseCard } from "./components/AdmCaseCard";
import { AdmCaseRail } from "./components/AdmCaseRail";
import { fetchMyAdmCases } from "@/services/teacher/admCases.service";
import type {
  AdmCase,
  MyAdmCasesPage,
} from "@/services/teacher/admCases.types";
import { useTerm } from "@/lib/term/TermContext";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./components/adm-cases.module.css";

const TEACHER_ADM_CASES_PAGE_SIZE = 15;

const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))",
  gap: "0.75rem",
  minWidth: 0,
};

function AdmCasesSkeletonGrid({ count }: { count: number }) {
  return (
    <div style={GRID_STYLE} aria-busy="true" aria-label="Loading ADM cases">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.skelCard} aria-hidden>
          <div className={styles.skelTop}>
            <Skeleton className={styles.skelMini} />
            <div className={styles.skelLines}>
              <Skeleton className={styles.skelLine} />
              <Skeleton className={styles.skelLineShort} />
            </div>
            <Skeleton className={styles.skelDot} />
          </div>
          <Skeleton className={styles.skelAvatar} />
          <Skeleton className={styles.skelName} />
          <Skeleton className={styles.skelSub} />
          <Skeleton className={styles.skelBar} />
          <div className={styles.skelActions}>
            <Skeleton className={styles.skelBtn} />
            <Skeleton className={styles.skelBtn} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TeacherAdvisoryAdmCasesView({ highlightId }: { highlightId: string | null }) {
  const router = useRouter();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [page, setPage] = useState(1);
  const [takeover, setTakeover] = useState(false);
  const [detailCase, setDetailCase] = useState<AdmCase | null>(null);

  const landing = !takeover && highlightId !== null;

  const casesQuery = useQuery<MyAdmCasesPage>({
    queryKey: ["adm-my-cases", takeover || !landing ? page : 1, termKey, landing ? (highlightId ?? "") : ""],
    queryFn: ({ signal }) =>
      fetchMyAdmCases({
        page: takeover || !landing ? page : 1,
        pageSize: TEACHER_ADM_CASES_PAGE_SIZE,
        ...(landing && highlightId ? { highlight: highlightId } : {}),
        signal,
      }),

    placeholderData: keepPreviousData,
    retry: false,
    // Cache pages so back/forward pagination is instant and deduped.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const goToPage = (next: number) => {
    setTakeover(true);
    setPage(next);
  };

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`teacher-adm-case-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, casesQuery.data]);

  const cases = useMemo(
    () => (Array.isArray(casesQuery.data?.cases) ? casesQuery.data.cases : []),
    [casesQuery.data]
  );
  const total = casesQuery.data?.total ?? cases.length;
  const unfilteredTotal = casesQuery.data?.unfilteredTotal ?? cases.length;

  const totalPages = Math.max(1, casesQuery.data?.totalPages ?? 1);
  const safePage = Math.min(casesQuery.data?.page ?? page, totalPages);
  const pageRows = cases;
  const isEmpty = !casesQuery.isPending && !casesQuery.isError && total === 0;
  // Pagination fetch: show skeleton cards (same grid shape) instead of
  // stacking/keeping stale rows, while cached pages resolve instantly.
  const isPageFetching =
    !casesQuery.isPending && !casesQuery.isError && casesQuery.isFetching;
  const paginationBusy = isPageFetching;

  function handleTrack(caseData: AdmCase) {

    writeLastViewedReferralId(caseData.referralId);
    setDetailCase(null);
    router.push("/teacher/advisory/referrals");
  }

  return (
    <section className={styles.page} aria-label="ADM cases">
      <div className={styles.body}>
        {isEmpty ? null : (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ADM Cases</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total === 1 ? "1 referred case" : `${total} referred cases`}
              {unfilteredTotal !== total ? ` (of ${unfilteredTotal} total)` : ""}.
            </p>
          </div>
        )}

        {casesQuery.isPending ? (
          <AdmCasesSkeletonGrid count={TEACHER_ADM_CASES_PAGE_SIZE} />
        ) : casesQuery.isError ? (
          <p className={styles.pageError}>
            No advisory section assigned, or the cases could not be loaded. Contact the
            school office.
          </p>
        ) : total === 0 ? (
          <div className="flex min-h-[calc(100dvh-8rem)] w-full items-center justify-center">
            <div className={`${assign.card} w-full max-w-md`}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-col items-center gap-2 py-6 text-center">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <FolderOpen size={24} className="text-muted-foreground" />
                </span>
                <p className="font-medium">No ADM cases yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  You haven&apos;t referred any ADM cases yet. Cases you refer appear here
                  as they move forward.
                </p>
                <Button size="sm" className="mt-2" onClick={() => router.push("/teacher/advisory/referrals")}>
                  Refer ADM cases
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`grid flex-1 items-stretch gap-4 transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none ${
              detailCase ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : "lg:grid-cols-[minmax(0,1fr)_0rem]"
            }`}
          >
            <div className="flex min-w-0 flex-col gap-4">
              {isPageFetching ? (
                <AdmCasesSkeletonGrid count={Math.max(pageRows.length, 6)} />
              ) : (
              <div style={GRID_STYLE} role="group" aria-label="ADM cases">
                {pageRows.map((c) => {
                  const highlighted =
                    highlightId !== null &&
                    (highlightId === c.id || highlightId === c.referralId);
                  return (
                    <div
                      key={c.id}
                      id={highlighted ? `teacher-adm-case-${highlightId}` : undefined}
                      data-highlighted={highlighted || undefined}
                      className={highlighted ? "rounded-md ring-2 ring-amber-500" : undefined}
                    >
                      <AdmCaseCard
                        caseData={c}
                        onDetails={() => setDetailCase(c)}
                      />
                    </div>
                  );
                })}
              </div>
              )}
              {total > TEACHER_ADM_CASES_PAGE_SIZE ? (
                <div className="relative flex items-center justify-end space-x-2">
                  <div className="text-muted-foreground flex-1 text-sm">
                    {total} case{total === 1 ? "" : "s"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1 || total === 0 || paginationBusy}
                      aria-busy={paginationBusy || undefined}
                      onClick={() => goToPage(Math.max(1, safePage - 1))}
                    >
                      <ChevronLeft aria-hidden />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages || total === 0 || paginationBusy}
                      aria-busy={paginationBusy || undefined}
                      onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                    >
                      Next
                      <ChevronRight aria-hidden />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className={`min-w-0 ${detailCase ? "" : "overflow-hidden"}`} inert={!detailCase}>
              <div
                className={`flex w-full max-w-full flex-col gap-4 self-start transition-all duration-300 ease-out motion-reduce:transition-none lg:fixed lg:top-16 lg:right-4 lg:bottom-4 lg:w-[20rem] lg:max-w-[20rem] lg:overflow-y-auto ${
                  detailCase ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
                }`}
              >
                {detailCase ? (
                  <AdmCaseRail
                    caseData={detailCase}
                    onClose={() => setDetailCase(null)}
                    onTrack={handleTrack}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TeacherAdvisoryAdmCasesPageWithHighlight() {

  const params = useSearchParams();
  return <TeacherAdvisoryAdmCasesView highlightId={params.get("highlight")} />;
}

export default function TeacherAdvisoryAdmCasesPage() {
  return (
    <Suspense fallback={<section className={styles.page} aria-busy="true" />}>
      <TeacherAdvisoryAdmCasesPageWithHighlight />
    </Suspense>
  );
}
