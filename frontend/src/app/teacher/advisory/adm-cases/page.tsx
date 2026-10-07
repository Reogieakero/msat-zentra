"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { writeLastViewedReferralId } from "../referrals/last-viewed";
import { AdmCaseCard } from "./components/AdmCaseCard";
import { AdmCaseRail } from "./components/AdmCaseRail";
import {
  fetchMyAdmCases,
  type AdmCase,
  type MyAdmCasesPage,
} from "./components/adm-cases-data";
import { useTerm } from "@/lib/term/TermContext";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "./components/adm-cases.module.css";

const TEACHER_ADM_CASES_PAGE_SIZE = 15;

// Narrower cards than the section grid default.
const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))",
  gap: "0.75rem",
  minWidth: 0,
};

/**
 * Teacher ADM cases: only ADM cases from referrals the teacher filed
 * (pending or principal-approved), one section-grid card per case.
 * Read-only — stage and status only, never confidential detail.
 */
function TeacherAdvisoryAdmCasesView({ highlightId }: { highlightId: string | null }) {
  const router = useRouter();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [page, setPage] = useState(1);
  const [takeover, setTakeover] = useState(false);
  const [detailCase, setDetailCase] = useState<AdmCase | null>(null);
  // Bell deep-links (?highlight=<id>) serve the case's own page; the first
  // pager touch takes over with plain params. Derived, no effects.
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
    // Page turns reuse the previous page so they never flash skeletons.
    placeholderData: keepPreviousData,
    retry: false,
  });
  const goToPage = (next: number) => {
    setTakeover(true);
    setPage(next);
  };

  // Scroll the highlighted case into view once its page renders. The
  // backend serves the highlight's own page, so the card is mounted here.
  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`teacher-adm-case-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, casesQuery.data]);
  // Stable reference so downstream memos don't recompute every render.
  const cases = useMemo(
    () => (Array.isArray(casesQuery.data?.cases) ? casesQuery.data.cases : []),
    [casesQuery.data]
  );
  const total = casesQuery.data?.total ?? cases.length;
  const unfilteredTotal = casesQuery.data?.unfilteredTotal ?? cases.length;

  // Derived, never setState-in-effect.
  const totalPages = Math.max(1, casesQuery.data?.totalPages ?? 1);
  const safePage = Math.min(casesQuery.data?.page ?? page, totalPages);
  const pageRows = cases;

  function handleTrack(caseData: AdmCase) {
    // Deep-link into the referrals workflow canvas on this case's referral.
    writeLastViewedReferralId(caseData.referralId);
    setDetailCase(null);
    router.push("/teacher/advisory/referrals");
  }

  return (
    <section className={styles.page}>
      <div className={styles.body}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ADM Cases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 1 ? "1 referred case" : `${total} referred cases`}
            {unfilteredTotal !== total ? ` (of ${unfilteredTotal} total)` : ""}.
          </p>
        </div>

        {casesQuery.isPending ? (
          <div style={GRID_STYLE} aria-busy="true" aria-label="Loading ADM cases">
            {Array.from({ length: 6 }).map((_, i) => (
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
        ) : casesQuery.isError ? (
          <p className={styles.pageError}>
            No advisory section assigned, or the cases could not be loaded. Contact the
            school office.
          </p>
        ) : total === 0 ? (
          <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center">
            <div className={`${assign.card} mx-auto w-full max-w-md`}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-col items-center gap-2 py-8 text-center">
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
              {total > TEACHER_ADM_CASES_PAGE_SIZE ? (
                <div className="relative flex items-center justify-end space-x-2">
                  <div className="text-muted-foreground flex-1 text-sm">
                    {total} case{total === 1 ? "" : "s"}
                  </div>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1 || total === 0}
                      onClick={() => goToPage(Math.max(1, safePage - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages || total === 0}
                      onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                    >
                      Next
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
  // useSearchParams needs a Suspense boundary under the app router.
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
