"use client";

import * as React from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
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
  AuditResponse,
  AuditRole,
} from "@/services/principal/audit.types";
import styles from "./page.module.css";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import { PageHeaderSkeleton } from "../components/skeletons/PageHeaderSkeleton";
import assign from "../academics/assign/components/section-assignments.module.css";
import { PAGE_SIZE } from "@/components/shared/pagination";

export default function PrincipalAuditPage() {
  const session = useSession();
  const currentUserId = session?.sub ?? "";

  const [actionType, setActionType] = React.useState<AuditActionType | "all">("all");
  const [actorRole, setActorRole] = React.useState<AuditRole | "all">("all");
  const [actorScope, setActorScope] = React.useState<ActorScope>("all");
  const [sourceTable, setSourceTable] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");

  const debouncedQuery = useDebouncedValue(query, 300);
  const [exporting, setExporting] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const queryClient = useQueryClient();

  const auditQuery = useQuery({
    queryKey: [
      "principal-audit",
      actionType,
      actorRole,
      actorScope,
      sourceTable,
      debouncedQuery,
      page,
      currentUserId,
    ],
    queryFn: ({ signal }) =>
      fetchAuditEntries(
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
      ),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const entries: AuditEntry[] = auditQuery.data?.entries ?? [];
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
    const cached = queryClient.getQueriesData<AuditResponse>({
      queryKey: ["principal-audit"],
    });
    for (const [, data] of cached) {
      for (const entry of data?.entries ?? []) {
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
  const start = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, totalCount);

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

      <section aria-label="Audit entries" className="flex min-w-0 flex-col gap-3">
        <div className={assign.card}>
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={styles.sectionTitle}>Audit Entries</h2>
              <p className={styles.sectionDesc} aria-live="polite">
                {totalCount === 0
                  ? "No audit entries on record."
                  : `${totalCount} ${totalCount === 1 ? "entry" : "entries"} across the school.`}
              </p>
            </div>
            <AuditToolbar
              actionType={actionType}
              onActionTypeChange={(v) => {
                setActionType(v);
                setPage(1);
              }}
              actorRole={actorRole}
              onActorRoleChange={(v) => {
                setActorRole(v);
                setPage(1);
              }}
              actorScope={actorScope}
              onActorScopeChange={(v) => {
                setActorScope(v);
                setPage(1);
              }}
              sourceTable={sourceTable}
              onSourceTableChange={(v) => {
                setSourceTable(v);
                setPage(1);
              }}
              sourceTables={knownTables}
              query={query}
              onQueryChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              onExport={handleExport}
              exporting={exporting}
            />
          </div>

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
            <>
              <div className="relative">
                <AuditTable entries={entries} />
              </div>
              {pageCount > 1 && (
                <div className="relative flex items-center justify-end space-x-2">
                  <div className="text-muted-foreground flex-1 text-sm">
                    {`${start}–${end} of ${totalCount}`}
                  </div>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1 || totalCount === 0}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= pageCount || totalCount === 0}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </section>
  );
}
