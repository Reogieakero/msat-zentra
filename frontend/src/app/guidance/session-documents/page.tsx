"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPaginationSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { GuidanceEmptyCard } from "../components/GuidanceEmptyCard";
import { GuidanceSessionDocumentsFolders } from "./components/guidance-session-documents-folders";
import { SessionDocumentCardSkeleton } from "./components/SessionDocumentCardSkeleton";
import type { TypeFilter } from "@/app/guidance/anecdotal/components/guidance-anecdotal-filters";
import { fetchAllGuidanceAnecdotal } from "@/services/guidance/anecdotal.service";
import type {
  GuidanceAnecdotalData,
  GuidanceAnecdotalRecord,
} from "@/services/guidance/anecdotal.types";
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

function readTypeParam(raw: string | null): TypeFilter {
  if (raw === "adm" || raw === "ADM") return "ADM";
  if (raw === "counseling" || raw === "Counseling") return "Counseling";
  return "";
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
  const [type, setTypeState] = React.useState<TypeFilter>(() =>
    readTypeParam(searchParams.get("type")),
  );

  // One request set for the whole queue, then search / type tabs / paging are
  // all client-side — typing never triggers a fetch or a stale request stack.
  const { data, isPending, isError, refetch, isRefetching } =
    useQuery<GuidanceAnecdotalData>({
      queryKey: ["guidance-session-documents", "queue", termKey],
      queryFn: ({ signal }) => fetchAllGuidanceAnecdotal({ signal, docsOnly: true }),
      staleTime: 60_000,
      enabled: termReady,
    });

  const allRecords = React.useMemo<GuidanceAnecdotalRecord[]>(
    () =>
      (Array.isArray(data?.records) ? data.records : []).filter(hasDocsCheck),
    [data],
  );

  const filtered = React.useMemo(() => {
    const needle = queryInput.trim().toLowerCase();
    return allRecords.filter((record) => {
      if (type && record.referralType !== type) return false;
      if (!needle) return true;
      const haystack = `${record.student} ${record.lrn} ${record.section}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [allRecords, queryInput, type]);

  const pager = useUrlPager(filtered.length, {}, {
    searchParam: "q",
    extraParams: ["type"],
    pageSize: GUIDANCE_SESSION_DOCS_PAGE_SIZE,
  });
  const page = pager.page;
  const setPage = pager.setPage;

  const handleQueryChange = (value: string) => {
    setQueryInput(value);
    if (page !== 1) setPage(1);
  };

  const handleTypeChange = (value: TypeFilter) => {
    setTypeState(value);
    pager.setFilters({ type: value === "" ? undefined : value });
  };

  const totalPages = pager.totalPages;
  const safePage = page;
  const visible = filtered.slice(
    (safePage - 1) * GUIDANCE_SESSION_DOCS_PAGE_SIZE,
    safePage * GUIDANCE_SESSION_DOCS_PAGE_SIZE,
  );

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

  const hasActiveFilters = queryInput.trim() !== "" || type !== "";
  if (allRecords.length === 0 && !hasActiveFilters) {
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
    <section className={styles.page} aria-label="Session documents">
      <GuidanceSessionDocumentsFolders
        records={visible}
        page={safePage}
        total={filtered.length}
        onPageChange={setPage}
        query={queryInput}
        onQueryChange={handleQueryChange}
        type={type}
        onTypeChange={handleTypeChange}
      />
    </section>
  );
}
