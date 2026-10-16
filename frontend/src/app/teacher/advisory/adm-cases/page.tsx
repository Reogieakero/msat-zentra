"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { AdmCaseTrackDialog } from "./components/AdmCaseTrackDialog";
import { AdmCasesTable } from "./components/AdmCasesTable";
import { AdmEmptyKanban } from "./components/AdmEmptyKanban";
import { fetchMyAdmCases } from "@/services/teacher/admCases.service";
import type {
  AdmCase,
  MyAdmCasesPage,
} from "@/services/teacher/admCases.types";
import { useTerm } from "@/lib/term/TermContext";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import refStyles from "../referrals/components/referrals.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";

const TEACHER_ADM_CASES_PAGE_SIZE = PAGE_SIZE;

function TeacherAdvisoryAdmCasesView({ highlightId }: { highlightId: string | null }) {
  const router = useRouter();
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const pager = useUrlPager(0, {});
  const page = pager.page;
  const setPage = pager.setPage;
  const [takeover, setTakeover] = useState(false);
  const [detailCase, setDetailCase] = useState<AdmCase | null>(null);
  // Filter text mirrors the referrals page: typed instantly, synced to ?q
  // (debounced) so refresh/back-forward keep the filter and page resets.
  const [queryInput, setQueryInput] = useState(pager.search);
  const debouncedQuery = useDebouncedValue(queryInput.trim(), 300);

  useEffect(() => {
    const wanted = debouncedQuery || "";
    if (wanted === pager.search) return;
    pager.setFilters({ q: wanted });
  }, [debouncedQuery, pager]);

  const landing = !takeover && highlightId !== null;

  const serverQuery = pager.search.trim() ? pager.search.trim() : undefined;
  const casesQuery = useQuery<MyAdmCasesPage>({
    queryKey: ["adm-my-cases", takeover || !landing ? page : 1, termKey, landing ? (highlightId ?? "") : "", serverQuery ?? ""],
    queryFn: ({ signal }) =>
      fetchMyAdmCases({
        page: takeover || !landing ? page : 1,
        pageSize: TEACHER_ADM_CASES_PAGE_SIZE,
        ...(serverQuery ? { q: serverQuery } : {}),
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

  function handleReferAdm() {
    router.push("/teacher/advisory/referrals");
  }

  // Error state renders inside AdmCasesTable (same Try-again card as the
  // referrals page), so only the truly-empty cases are handled here.
  const showEmpty = !casesQuery.isPending && !casesQuery.isError && total === 0;

  return (
    <section className={refStyles.page} aria-label="ADM cases">
      <div className={refStyles.layout}>
        <div className={refStyles.body}>
          {showEmpty ? (
            unfilteredTotal === 0 ? (
              <div className="flex min-h-[calc(100dvh-10rem)] w-full items-center justify-center">
                <div className="w-full">
                  <AdmEmptyKanban onReferAdm={handleReferAdm} />
                </div>
              </div>
            ) : (
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
                    <p className="font-medium">No ADM cases match</p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Try a different search or filter.
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <AdmCasesTable
                cases={pageRows}
                total={total}
                unfilteredTotal={unfilteredTotal}
                query={queryInput}
                onQueryChange={setQueryInput}
                highlightId={highlightId}
                casesQuery={{
                  isPending: casesQuery.isPending,
                  isError: casesQuery.isError,
                  isFetching: casesQuery.isFetching,
                  refetch: () => void casesQuery.refetch(),
                }}
                onDetails={(c) => setDetailCase(c)}
                onReferAdm={handleReferAdm}
                currentPage={safePage}
                onPageChange={(p) => goToPage(p)}
              />
              <AdmCaseTrackDialog
                caseData={detailCase}
                onClose={() => setDetailCase(null)}
              />
            </div>
          )}
        </div>
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
    <Suspense fallback={<section className={refStyles.page} aria-busy="true" />}>
      <TeacherAdvisoryAdmCasesPageWithHighlight />
    </Suspense>
  );
}
