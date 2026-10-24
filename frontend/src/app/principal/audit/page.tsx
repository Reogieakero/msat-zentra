"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuditToolbar, type ActorScope } from "./components/AuditToolbar";
import { AuditTable } from "./components/AuditTable";
import { AuditSkeleton } from "./components/AuditSkeleton";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { PrincipalEmptyState } from "../components/PrincipalEmptyCard";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/useSession";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toast } from "@/components/ui/sonner";
import {
  fetchAuditEntries,
  exportAuditCsv,
} from "@/services/principal/audit.service";
import type {
  AuditActionType,
  AuditEntry,
  AuditRole,
} from "@/services/principal/audit.types";
import styles from "./page.module.css";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import { useUrlPager } from "@/components/shared/pagination/useUrlPager";
import { usePaginatedQuery } from "@/lib/api/usePaginatedQuery";
import { useSearchParams } from "next/navigation";

export default function PrincipalAuditPage() {
  return (
    <React.Suspense>
      <PrincipalAuditPageInner />
    </React.Suspense>
  );
}

function PrincipalAuditPageInner() {
  const session = useSession();
  const currentUserId = session?.sub ?? "";
  const searchParams = useSearchParams();

  const [actionType, setActionType] = React.useState<AuditActionType | "all">(
    (searchParams.get("actionType") as AuditActionType | null) ?? "all",
  );
  const [actorRole, setActorRole] = React.useState<AuditRole | "all">(
    (searchParams.get("actorRole") as AuditRole | null) ?? "all",
  );
  const [actorScope, setActorScope] = React.useState<ActorScope>(
    (searchParams.get("scope") as ActorScope | null) ?? "all",
  );
  const [sourceTable, setSourceTable] = React.useState<string | "all">(
    searchParams.get("sourceTable") ?? "all",
  );
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");

  const debouncedQuery = useDebouncedValue(query, 300);
  const [exporting, setExporting] = React.useState(false);
  const queryClient = useQueryClient();

  const filters = React.useMemo(
    () => ({
      actionType,
      actorRole,
      actorScope,
      sourceTable,
      q: debouncedQuery || undefined,
      userId: actorScope === "me" ? currentUserId : undefined,
    }),
    [actionType, actorRole, actorScope, sourceTable, debouncedQuery, currentUserId],
  );

  // Total is unknown until the first fetch; the pager clamps once it arrives.
  const pager = useUrlPager(0, {}, { extraParams: ["q", "actionType", "actorRole", "scope", "sourceTable"] });
  const page = pager.page;

  const auditQuery = usePaginatedQuery<AuditEntry>({
    module: "principal",
    resource: "audit",
    page,
    pageSize: PAGE_SIZE,
    filters: filters as Record<string, unknown>,
    preset: "semi",
    fetcher: async (signal) => {
      const res = await fetchAuditEntries(
        {
          actionType,
          actorRole,
          sourceTable,
          userId: actorScope === "me" ? currentUserId : undefined,
          q: debouncedQuery || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
        signal,
      );
      return {
        data: res.entries,
        total: res.total,
        page: res.page,
        pageSize: PAGE_SIZE,
        totalPages: Math.max(1, Math.ceil(res.total / PAGE_SIZE)),
      };
    },
  });

  const entries: AuditEntry[] = auditQuery.data?.data ?? [];
  const total = auditQuery.data?.total ?? 0;
  const loading = auditQuery.isPending;
  const error = auditQuery.isError
    ? (() => {
        const status = (auditQuery.error as { response?: { status?: number } })?.response?.status;
        return status ? `Failed to load audit log (HTTP ${status})` : "Failed to load audit log";
      })()
    : null;

  const knownTables = React.useMemo(() => {
    const tables = new Set<string>();
    const cached = queryClient.getQueriesData<{ data?: AuditEntry[] }>({
      queryKey: ["principal", "audit"],
    });
    for (const [, data] of cached) {
      for (const entry of data?.data ?? []) {
        const name = entry.sourceTable?.trim();
        if (name) tables.add(name);
      }
    }
    return Array.from(tables).sort((a, b) => a.localeCompare(b));
  }, [queryClient, auditQuery.dataUpdatedAt]);

  const handleRetry = () => {
    void auditQuery.refetch();
  };
  const handleExport = () => {
    if (exporting) return;
    setExporting(true);
    exportAuditCsv({
      actionType,
      actorRole,
      sourceTable,
      userId: actorScope === "me" ? currentUserId : undefined,
      q: debouncedQuery || undefined,
    })
      .then(() => toast.success({ title: "Audit log exported" }))
      .catch((err) => {
        console.error("[/api/audit/export] failed:", err);
        toast.error({ title: "Export failed", description: "Could not export the audit log." });
      })
      .finally(() => setExporting(false));
  };

  const hasActiveFilters =
    actionType !== "all" ||
    actorRole !== "all" ||
    actorScope !== "all" ||
    sourceTable !== "all" ||
    query.trim() !== "";

  const totalCount = total;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  // Sync debounced search to the URL and reset to page 1 when it changes.
  const firstSearchSync = React.useRef(true);
  React.useEffect(() => {
    if (firstSearchSync.current) {
      firstSearchSync.current = false;
      return;
    }
    pager.setFilters({ q: debouncedQuery || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const isEmpty = !loading && !error && totalCount === 0 && !hasActiveFilters && query.trim() === "";
  const headerLoading = loading;
  return (
    <section className={styles.page} aria-busy={headerLoading || undefined}>
      {headerLoading ? (
        <PageHeaderSkeleton />
      ) : isEmpty ? null : (
      <PrincipalPageHeader
        title="Audit Log"
        description="School-wide record of sensitive actions. Immutable — entries cannot be edited or deleted."
      />
      )}

      <KanbanBoard
        title="Audit Entries"
        icon={<ShieldCheck size={14} aria-hidden="true" />}
        count={totalCount}
        description={
          totalCount === 0
            ? "No audit entries on record."
            : `${totalCount} ${totalCount === 1 ? "entry" : "entries"} across the school.`
        }
        toolbar={
            <AuditToolbar
              actionType={actionType}
              onActionTypeChange={(v) => {
                setActionType(v);
                pager.setFilters({ actionType: v === "all" ? undefined : v });
              }}
              actorRole={actorRole}
              onActorRoleChange={(v) => {
                setActorRole(v);
                pager.setFilters({ actorRole: v === "all" ? undefined : v });
              }}
              actorScope={actorScope}
              onActorScopeChange={(v) => {
                setActorScope(v);
                pager.setFilters({ scope: v === "all" ? undefined : v });
              }}
              sourceTable={sourceTable}
              onSourceTableChange={(v) => {
                setSourceTable(v);
                pager.setFilters({ sourceTable: v === "all" ? undefined : v });
              }}
              sourceTables={knownTables}
              query={query}
              onQueryChange={(v) => {
                setQuery(v);
              }}
              onExport={handleExport}
              exporting={exporting}
            />
        }
        footer={
          <Pagination
            currentPage={safePage}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            onPageChange={pager.setPage}
          />
        }
      >
          {error ? (
            <div className="relative flex flex-col items-center gap-2 py-6 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                aria-hidden="true"
              >
                <TriangleAlert size={24} className="text-muted-foreground" />
              </span>
              <p className="font-medium">Couldn&apos;t load the audit log</p>
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="relative overflow-x-auto rounded-md border">
              <AuditSkeleton rows={PAGE_SIZE} />
            </div>
          ) : entries.length === 0 ? (
            <PrincipalEmptyState
              icon={ShieldCheck}
              title="No audit entries"
              hint={
                query.trim()
                  ? `No audit entries match "${query}".`
                  : hasActiveFilters
                    ? "No audit entries match the selected filters."
                    : "Sensitive actions will appear here once recorded."
              }
            />
          ) : (
            <div className="relative">
              <AuditTable entries={entries} />
            </div>
          )}
      </KanbanBoard>
    </section>
  );
}
