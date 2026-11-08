"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidanceEmptyCard } from "../components/GuidanceEmptyCard";
import { FolderLegendCard } from "@/app/teacher/anecdotal/components/AnecdotalSideRail";
import {
  GuidanceAnecdotalSidebar,
  TopReferredCard,
} from "./components/guidance-anecdotal-siderail";
import { GuidanceAnecdotalFolders } from "./components/guidance-anecdotal-folders";
import type { TypeFilter } from "./components/guidance-anecdotal-filters";
import { fetchAllGuidanceAnecdotal } from "@/services/guidance/anecdotal.service";
import type {
  GuidanceAnecdotalData,
  GuidanceAnecdotalRecord,
} from "@/services/guidance/anecdotal.types";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./components/guidance-anecdotal.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";

const GUIDANCE_ANECDOTAL_PAGE_SIZE = PAGE_SIZE;

function readTypeParam(raw: string | null): TypeFilter {
  if (raw === "adm" || raw === "ADM") return "ADM";
  if (raw === "counseling" || raw === "Counseling") return "Counseling";
  return "";
}

export default function GuidanceAnecdotalPage() {
  return (
    <React.Suspense>
      <GuidanceAnecdotalPageInner />
    </React.Suspense>
  );
}

function GuidanceAnecdotalPageInner() {
  const searchParams = useSearchParams();
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const [type, setTypeState] = React.useState<TypeFilter>(() =>
    readTypeParam(searchParams.get("type")),
  );

  // One request set for the whole queue, then search / type tabs / paging are
  // all client-side — typing never triggers a fetch or a stale request stack.
  const { data, isPending, isError, refetch, isRefetching } =
    useQuery<GuidanceAnecdotalData>({
      queryKey: ["guidance-anecdotal", "queue", termKey],
      queryFn: ({ signal }) => fetchAllGuidanceAnecdotal({ signal }),
      staleTime: 60_000,
      enabled: termReady,
    });

  const allRecords = React.useMemo<GuidanceAnecdotalRecord[]>(
    () => (Array.isArray(data?.records) ? data.records : []),
    [data],
  );

  const filtered = React.useMemo(() => {
    const needle = queryInput.trim().toLowerCase();
    return allRecords.filter((record) => {
      if (type && record.referralType !== type) return false;
      if (!needle) return true;
      const haystack =
        `${record.student} ${record.lrn} ${record.section} ${record.observer} ${record.referredBy} ${record.category}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [allRecords, queryInput, type]);

  const pager = useUrlPager(filtered.length, {}, {
    searchParam: "q",
    extraParams: ["type"],
    pageSize: GUIDANCE_ANECDOTAL_PAGE_SIZE,
  });
  const page = pager.page;
  const setPage = pager.setPage;

  const handleQueryChange = (value: string) => {
    setQueryInput(value);
    // Local filtering is instant — only reset the pager, and skip the URL write
    // while already on page 1 so typing never triggers router churn.
    if (page !== 1) setPage(1);
  };

  const handleTypeChange = (value: TypeFilter) => {
    setTypeState(value);
    pager.setFilters({ type: value === "" ? undefined : value });
  };

  const totalPages = pager.totalPages;
  const safePage = page;
  const pageRecords = filtered.slice(
    (safePage - 1) * GUIDANCE_ANECDOTAL_PAGE_SIZE,
    safePage * GUIDANCE_ANECDOTAL_PAGE_SIZE,
  );

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading referred records">
        <div className="grid flex-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
          <div className={`${styles.main} flex min-w-0 flex-col`}>
            <div className={styles.skelPanel}>
              <div className={styles.skelPanelHead}>
                <div className={styles.skelPanelHeadText}>
                  <div className={styles.skelPanelTitleRow}>
                    <Skeleton className={styles.skelPanelTitle} />
                    <Skeleton className={styles.skelHelpBtn} />
                  </div>
                  <Skeleton className={styles.skelPanelDesc} />
                </div>
                <div className={styles.skelPanelActions}>
                  <Skeleton className={styles.skelSearch} />
                  <Skeleton className={styles.skelDrop} />
                </div>
              </div>
              <div className={styles.skelFolderGrid}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={styles.skelFolderCard}>
                    <Skeleton className={styles.skelFolderBadge} />
                    <Skeleton className={styles.skelFolder} />
                    <Skeleton className={styles.skelFolderLabel} />
                    <Skeleton className={styles.skelFolderSub} />
                  </div>
                ))}
              </div>
              <div className={styles.skelPager}>
                <Skeleton className={styles.skelRange} />
                <div className={styles.skelPagerBtns}>
                  <Skeleton className={styles.skelBtn} />
                  <Skeleton className={styles.skelPageLabel} />
                  <Skeleton className={styles.skelBtn} />
                </div>
              </div>
            </div>
          </div>
          <div className="hidden min-w-0 flex-col items-end gap-2 lg:flex" aria-hidden="true">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load the anecdotal records.</p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button
            size="sm"
            variant="outline"
            disabled={isRefetching}
            onClick={() => refetch()}
          >
            {isRefetching ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {isRefetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </section>
    );
  }

  const hasActiveFilters = queryInput.trim() !== "" || type !== "";
  if (allRecords.length === 0 && !hasActiveFilters) {
    return (
      <section className={styles.page} aria-label="Anecdotal records">
        <GuidanceEmptyCard
          icon={FolderOpen}
          title="No referred files yet"
          hint="Every ADM and counseling case advisers refer to you will appear here as its own folder."
          label="Anecdotal records"
          action={
            <Button asChild size="sm" className="mt-2">
              <Link href="/guidance/referrals">View referrals</Link>
            </Button>
          }
          centered
        />
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="Anecdotal records">
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className={`${styles.main} flex min-w-0 flex-col`}>
          <GuidanceAnecdotalFolders
            records={pageRecords}
            page={safePage}
            pageSize={GUIDANCE_ANECDOTAL_PAGE_SIZE}
            total={filtered.length}
            totalPages={totalPages}
            onPageChange={setPage}
            query={queryInput}
            onQueryChange={handleQueryChange}
            type={type}
            onTypeChange={handleTypeChange}
          />
        </div>
        <GuidanceAnecdotalSidebar items={data.summary.topStudents ?? []} />
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:hidden">
        <TopReferredCard items={data.summary.topStudents ?? []} />
        <FolderLegendCard />
      </div>
    </section>
  );
}
