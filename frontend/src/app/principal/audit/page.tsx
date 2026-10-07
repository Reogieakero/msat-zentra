"use client";

import * as React from "react";

import { AuditToolbar, type ActorScope } from "./components/AuditToolbar";
import { AuditTable } from "./components/AuditTable";
import { AuditSkeleton } from "./components/AuditSkeleton";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/useSession";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { toast } from "@/components/ui/sonner";
import {
  fetchAuditEntries,
  exportAuditCsv,
  AuditActionType,
  AuditRole,
} from "./audit-data";
import type { AuditEntry } from "./audit-data";
import styles from "./page.module.css";
import { PrincipalPageHeader } from "../components/PrincipalPageHeader";
import assign from "../academics/assign/components/section-assignments.module.css";

const PAGE_SIZE = 25;

export default function PrincipalAuditPage() {
  const session = useSession();
  const currentUserId = session?.sub ?? "";

  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [actionType, setActionType] = React.useState<AuditActionType | "all">("all");
  const [actorRole, setActorRole] = React.useState<AuditRole | "all">("all");
  const [actorScope, setActorScope] = React.useState<ActorScope>("all");
  const [sourceTable, setSourceTable] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");
  // Debounced 300ms (matches ADM referrals) so typing doesn't fan out requests.
  const debouncedQuery = useDebouncedValue(query, 300);
  const [exporting, setExporting] = React.useState(false);
  const [page, setPage] = React.useState(1);
  // Union of every source table seen across all fetched pages (trimmed,
  // exact-value deduped). The dropdown options stay stable while paging
  // instead of reshuffling to each page's 25 rows — and near-duplicate
  // variants (case/whitespace) can never appear twice.
  const [knownTables, setKnownTables] = React.useState<string[]>([]);

  const load = React.useCallback(
    (abort?: AbortSignal) => {
      setLoading(true);
      setError(null);
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
        abort,
      )
        .then((res) => {
          setEntries(res.entries);
          setTotal(res.total);
          setKnownTables((prev) => {
            const next = new Set(prev);
            for (const e of res.entries) {
              const t = e.sourceTable?.trim();
              if (t) next.add(t);
            }
            return next.size === prev.length &&
              prev.every((t) => next.has(t))
              ? prev
              : Array.from(next).sort((a, b) => a.localeCompare(b));
          });
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === "CanceledError") return;
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(
            status
              ? `Failed to load audit log (HTTP ${status})`
              : "Failed to load audit log",
          );
          console.error("[/api/audit] fetch failed:", err);
        })
        .finally(() => setLoading(false));
    },
    [actionType, actorRole, sourceTable, actorScope, currentUserId, debouncedQuery, page],
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    // Async data fetch on filter/page change — setState happens inside the
    // promise chain, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const handleRetry = () => load();
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

  return (
    <section className={styles.page}>
      <PrincipalPageHeader
        title="Audit Log"
        description="School-wide record of sensitive actions. Immutable — entries cannot be edited or deleted."
      />

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
            <div className="relative flex flex-col items-center gap-2 py-6 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                aria-hidden="true"
              >
                <ShieldCheck size={24} className="text-muted-foreground" />
              </span>
              <p className="font-medium">No audit entries</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {query.trim()
                  ? `No audit entries match "${query}".`
                  : hasActiveFilters
                    ? "No audit entries match the selected filters."
                    : "Sensitive actions will appear here once recorded."}
              </p>
            </div>
          ) : (
            <>
              <div className="relative">
                <AuditTable entries={entries} />
              </div>
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
            </>
          )}
        </div>
      </section>
    </section>
  );
}
