"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceEmptyCard } from "../components/GuidanceEmptyCard";
import { FolderLegendCard } from "@/app/teacher/anecdotal/components/AnecdotalSideRail";
import {
  GuidanceAnecdotalSidebar,
  TopReferredCard,
} from "./components/guidance-anecdotal-siderail";
import { GuidanceAnecdotalFolders } from "./components/guidance-anecdotal-folders";
import { GuidanceAnecdotalSkeleton } from "./components/GuidanceAnecdotalSkeleton";
import type { TypeFilter } from "./components/guidance-anecdotal-filters";
import { fetchAllGuidanceAnecdotal } from "@/services/guidance/anecdotal.service";
import type {
  GuidanceAnecdotalData,
  GuidanceAnecdotalRecord,
} from "@/services/guidance/anecdotal.types";
import { useTerm } from "@/lib/term/TermContext";
import { liveQueryOptions } from "@/lib/api/live";
import styles from "./components/guidance-anecdotal.module.css";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";

// Guidance folder boards lay out a 4×4 card grid, so they page at 16 instead of
// the global 15 (same exception as the referrals/interventions guidance queues).
const GUIDANCE_ANECDOTAL_PAGE_SIZE = 16;

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
      ...liveQueryOptions,
      queryKey: ["guidance-anecdotal", "queue", termKey],
      queryFn: ({ signal }) => fetchAllGuidanceAnecdotal({ signal }),
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
    return <GuidanceAnecdotalSkeleton />;
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
      <section className={`${styles.page} relative`} aria-label="Anecdotal records">
        {/* Page-level action sits top-right, like the other desk empty states;
            the callout itself stays centered. */}
        <Button asChild size="sm" className="absolute right-0 top-0 h-6 gap-1 px-2 text-xs">
          <Link href="/guidance/referrals">
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
            View referrals
          </Link>
        </Button>
        <GuidanceEmptyCard
          icon={FolderOpen}
          title="No referred files yet"
          hint="Every ADM and counseling case advisers refer to you will appear here as its own folder."
          label="Anecdotal records"
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
