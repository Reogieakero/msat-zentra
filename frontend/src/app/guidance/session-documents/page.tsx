"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPaginationSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { GuidanceEmptyCard } from "../components/GuidanceEmptyCard";
import { GuidanceSessionDocumentsFolders } from "./components/guidance-session-documents-folders";
import { SessionDocumentCardSkeleton } from "./components/SessionDocumentCardSkeleton";
import type { TypeFilter } from "@/app/guidance/anecdotal/components/guidance-anecdotal-filters";
import { fetchGuidanceAnecdotal } from "@/services/guidance/anecdotal.service";
import type { GuidanceAnecdotalData } from "@/services/guidance/anecdotal.types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useTerm } from "@/lib/term/TermContext";
import styles from "@/app/guidance/anecdotal/components/guidance-anecdotal.module.css";
import listStyles from "./components/guidance-session-documents-folders.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams } from "next/navigation";

const GUIDANCE_SESSION_DOCS_PAGE_SIZE = PAGE_SIZE;

function hasDocsCheck(record: { sessionDocs?: { files: { mimeType: string }[] }[] }): boolean {
  return (record.sessionDocs ?? []).some((s) =>
    (s.files ?? []).some((f) => f.mimeType.toLowerCase().startsWith("image/"))
  );
}

export default function GuidanceSessionDocumentsPage() {
  return (
    <React.Suspense>
      <GuidanceSessionDocumentsPageInner />
    </React.Suspense>
  );
}

function GuidanceSessionDocumentsPageInner() {
  const searchParams = useSearchParams();
  const { activeTerm, termReady } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const [type, setTypeState] = React.useState<TypeFilter>(
    searchParams.get("type") === "adm" || searchParams.get("type") === "counseling"
      ? (searchParams.get("type") as TypeFilter)
      : "",
  );
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q", "type"] });
  const page = pager.page;
  const setPage = pager.setPage;
  const setType = React.useCallback(
    (value: TypeFilter) => {
      setTypeState(value);
      pager.setFilters({ type: value === "" ? undefined : value });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const query = useDebouncedValue(queryInput.trim(), 300);

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

  const handleQueryInputChange = (value: string) => {
    setQueryInput(value);
  };

  const { data, isPending, isError, isFetching, refetch, isRefetching } =
    useQuery<GuidanceAnecdotalData>({
      queryKey: ["guidance-session-documents", page, query, type, termKey],
      queryFn: ({ signal }) =>
        fetchGuidanceAnecdotal(
          {
            q: query || undefined,
            type,
            docsOnly: true,
            page,
            pageSize: GUIDANCE_SESSION_DOCS_PAGE_SIZE,
          },
          { signal }
        ),
      staleTime: 60_000,
      placeholderData: keepPreviousData,
      enabled: termReady,
    });

  const docsRecords = React.useMemo(
    () =>
      (Array.isArray(data?.records) ? data.records : []).filter(hasDocsCheck),
    [data]
  );

  const total = data?.total ?? docsRecords.length;
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const safePage = Math.min(data?.page ?? page, totalPages);
  const visible = docsRecords;

  if (isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading session documents">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Skeleton className="h-8 w-56 max-w-full shrink-0 rounded-[16px]" />
          </div>
          <div className={listStyles.studentGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <SessionDocumentCardSkeleton key={i} />
            ))}
          </div>
          <ZentraPaginationSkeleton />
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Could not load the session documents.</p>
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

  const hasActiveFilters = query !== "" || type !== "";
  if (data.total === 0 && !hasActiveFilters) {
    return (
      <section className={styles.page} aria-label="Session documents">
        <GuidanceEmptyCard
          icon={FolderOpen}
          title="No session files yet"
          hint="Images attached to counseling sessions — on referrals or interventions — will appear here."
          label="Session documents"
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
    <section
      className={styles.page}
      aria-label="Session documents"
      aria-busy={isFetching && !isPending}
    >
      <GuidanceSessionDocumentsFolders
        records={visible}
        page={safePage}
        total={total}
        onPageChange={setPage}
        query={queryInput}
        onQueryChange={handleQueryInputChange}
        type={type}
        onTypeChange={(value) => {
          setType(value);
          setPage(1);
        }}
      />
    </section>
  );
}
