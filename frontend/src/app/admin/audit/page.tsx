"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ZentraPageHeader } from "@/components/shared/zentra-page-header/ZentraPageHeader";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { fetchAdminAudit } from "@/services/admin/admin.service";
import styles from "../users/users.module.css";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettyAction(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default function AdminAuditPage() {
  return (
    <React.Suspense>
      <AdminAuditPageInner />
    </React.Suspense>
  );
}

function AdminAuditPageInner() {
  const [queryInput, setQueryInput] = React.useState("");
  const debouncedQuery = useDebouncedValue(queryInput, 300);
  const pager = useUrlPager(0, {});

  React.useEffect(() => {
    pager.setFilters({ q: debouncedQuery || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const query = useQuery({
    queryKey: ["admin", "audit", pager.page, debouncedQuery],
    queryFn: ({ signal }) =>
      fetchAdminAudit({
        page: pager.page,
        pageSize: PAGE_SIZE,
        q: debouncedQuery || undefined,
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const rows = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;

  return (
    <section className={styles.page}>
      <ZentraPageHeader
        title="Audit log"
        description="Every recorded action across the system, newest first."
      />

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={15} aria-hidden="true" />
          <Input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Search reason, source, or actor email"
            aria-label="Search audit log"
          />
        </label>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Source</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={5}>
                    <Skeleton className={styles.rowSkeleton} />
                  </td>
                </tr>
              ))
            ) : query.isError ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Could not load the audit log.{" "}
                  <button type="button" className={styles.inlineBtn} onClick={() => void query.refetch()}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  No audit entries match this search.
                </td>
              </tr>
            ) : (
              rows.map((entry) => (
                <tr key={entry.id}>
                  <td className={styles.muted}>{formatDateTime(entry.timestamp)}</td>
                  <td>
                    <span className={styles.name}>{entry.user}</span>
                    <span className={styles.rolePill}>{entry.actorRole}</span>
                  </td>
                  <td>
                    <span className={styles.rolePill}>{prettyAction(entry.actionType)}</span>
                  </td>
                  <td>
                    <span className={styles.name}>{entry.sourceLabel}</span>
                  </td>
                  <td className={styles.muted}>{entry.reason || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={pager.page}
        totalItems={total}
        pageSize={PAGE_SIZE}
        onPageChange={pager.setPage}
      />

      <p className={styles.note}>
        <ShieldCheck size={14} aria-hidden="true" /> Audit entries are append-only and cannot be
        edited from this console.
      </p>
    </section>
  );
}
