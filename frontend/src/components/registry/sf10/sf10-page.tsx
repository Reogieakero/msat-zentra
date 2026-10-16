"use client";
import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  FolderOpen,
  Search,
  SearchX,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RecordKeeperEmptyState } from "@/app/record-keeper/components/RecordKeeperEmptyCard";
import { RecordKeeperPageHeader } from "@/app/record-keeper/components/RecordKeeperPageHeader";
import { RegistrarEmptyState } from "@/app/registrar/components/RegistrarEmptyCard";
import { RegistrarPageHeader } from "@/app/registrar/components/RegistrarPageHeader";
import { PageHeaderSkeleton } from "@/app/principal/components/skeletons/PageHeaderSkeleton";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { Pagination } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchSf10Records } from "@/services/registry/sf10.service";
import { Sf10FolderGrid } from "@/components/registry/sf10/sf10-folders";
import {
  type Sf10Record,
  type Sf10Status,
} from "@/services/registry/sf10.types";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import styles from "@/components/registry/sf10/sf10.module.css";
const STATUS_FILTERS: { key: Sf10Status | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attach", label: "Attached" },
  { key: "released", label: "Released" },
];
export function Sf10Page({
  desk,
  pageSize,
}: {
  desk: "registrar" | "record-keeper";
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryInput, setQueryInput] = React.useState(searchParams.get("q") ?? "");
  const query = useDebouncedValue(queryInput.trim(), 300);
  const [status, setStatusState] = React.useState<Sf10Status | "all">(
    (searchParams.get("status") as Sf10Status | null) ?? "all",
  );
  const pager = useUrlPager(0, {}, { searchParam: "q", extraParams: ["q", "status"] });
  const page = pager.page;
  const setPage = pager.setPage;
  const setStatus = React.useCallback(
    (value: Sf10Status | "all") => {
      setStatusState(value);
      pager.setFilters({ status: value === "all" ? undefined : value });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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
  const openRecord = (r: Sf10Record) => {
    router.push(`/${desk}/sf10/${r.id}`);
  };
  const EmptyState = desk === "registrar" ? RegistrarEmptyState : RecordKeeperEmptyState;
  const {
    data,
    isPending,
    isError,
    isFetching,
  } = useQuery({
    queryKey: [`${desk}-sf10`, page, query, status],
    queryFn: ({ signal }) =>
      fetchSf10Records({
        page,
        pageSize,
        ...(query ? { q: query } : {}),
        ...(status !== "all" ? { status } : {}),
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const pageRows = React.useMemo(() => data?.records ?? [], [data]);
  const counts = React.useMemo(
    () => data?.counts ?? { attach: 0, available: 0, released: 0, total: 0 },
    [data],
  );
  const filteredTotal = data?.total ?? pageRows.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(page, totalPages);
  const filtering = query.length > 0 || status !== "all";
  const isSyncing = isFetching && !isPending;
  const DeskPageHeader = desk === "registrar" ? RegistrarPageHeader : RecordKeeperPageHeader;
  const headerTitle = "SF10 Records";
  const deskLabel = desk === "registrar" ? "registrar" : "record keeper";
  const headerDescription = `SF10 files filed by the ${deskLabel} — validated, attached, and released.`;
  if (!isPending && !isError && counts.total === 0) {
    return (
      <section className={styles.page}>
        <div className={styles.emptyWrap}>
          <div className={styles.emptyStack}>
            <section className={`${assign.card} ${styles.emptyCard}`} aria-label="No SF10 records">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <EmptyState
                icon={FolderOpen}
                title="No SF10 records yet"
                hint={`Upload a file to attach the first SF10 record filed by the ${deskLabel}.`}
              />
              <div className="relative mt-3 flex justify-center">
                <Button asChild size="sm">
                  <Link href={`/${desk}/sf10/upload`}>
                    <Upload aria-hidden />
                    Upload SF10
                  </Link>
                </Button>
              </div>
            </section>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className={styles.page}>
      <div className={styles.stack}>
        {isPending ? (
          <PageHeaderSkeleton />
        ) : (
          <DeskPageHeader title={headerTitle} description={headerDescription} />
        )}
        <section className={assign.card} aria-label="SF10 summary">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          {isPending ? (
            <ul className={`${styles.tiles} relative`}>
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className={styles.tileSkel} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className={`${styles.tiles} relative`}>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{counts.attach}</span>
                <span className={styles.tileLabel}>Attached</span>
                <span className={styles.tileHint}>Uploaded files, stored as-is</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{counts.released}</span>
                <span className={styles.tileLabel}>Released</span>
                <span className={styles.tileHint}>Released and archived</span>
              </li>
              <li className={styles.tile}>
                <span className={styles.tileValue}>{counts.total}</span>
                <span className={styles.tileLabel}>Total records</span>
                <span className={styles.tileHint}>SF10 files filed by this desk</span>
              </li>
            </ul>
          )}
        </section>
        <section aria-labelledby="sf10-records">
          <div className={`${styles.listHead} relative`}>
            <div className={styles.listHeadText}>
              <h2 id="sf10-records" className="text-base font-semibold">
                SF10 Records
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Learner SF10 files filed by the {deskLabel} —{" "}
                {isPending ? "…" : `${filteredTotal} shown${isSyncing ? " · Syncing…" : ""}`}.
              </p>
            </div>
            <div className={styles.headerActions}>
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href={`/${desk}/sf10/upload`}>
                  <Upload aria-hidden />
                  Upload
                </Link>
              </Button>
              <div className={styles.searchWrap}>
                <Search className={styles.searchIcon} aria-hidden />
                <Input
                  className={styles.search}
                  placeholder="Search name, LRN, or section…"
                  value={queryInput}
                  onChange={(e) => {
                    setQueryInput(e.target.value);
                  }}
                  aria-label="Search SF10 records"
                />
              </div>
              {queryInput && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.clearBtn}
                  onClick={() => {
                    setQueryInput("");
                  }}
                >
                  <X aria-hidden />
                  Show all
                </Button>
              )}
            </div>
          </div>
          <div className={`${styles.filterRow} relative`} role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.key}
                type="button"
                variant={status === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatus(f.key);
                }}
                aria-pressed={status === f.key}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className={`${styles.content} relative`}>
            {isPending ? (
              <div className={styles.folderGrid} aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 w-full rounded-xl" />
                ))}
              </div>
            ) : isError ? (
              <p className={styles.empty}>Could not load SF10 records.</p>
            ) : filtering && pageRows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No matching records"
                hint="No SF10 records match the current search or filter."
              />
            ) : (
              <Sf10FolderGrid records={pageRows} onOpen={openRecord} />
            )}
          </div>
          {filteredTotal > pageSize && (
            <Pagination
              currentPage={safePage}
              totalItems={filteredTotal}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          )}
        </section>
      </div>
    </section>
  );
}
