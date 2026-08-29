"use client";

import * as React from "react";

import { AuditToolbar, type ActorScope } from "./components/AuditToolbar";
import { AuditTable } from "./components/AuditTable";
import { AuditPagination } from "./components/AuditPagination";
import { AuditSkeleton } from "./components/AuditSkeleton";
import { useSession } from "@/lib/auth/useSession";
import {
  fetchAuditEntries,
  exportAuditCsv,
  AuditEntry,
  AuditActionType,
  AuditRole,
} from "./audit-data";
import styles from "./page.module.css";

const PAGE_SIZE = 25;

export default function PrincipalAuditPage() {
  const session = useSession();
  const currentUserId = session?.sub ?? "";
  const currentUserEmail = session?.role === "principal" ? "principal" : "";

  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [actionType, setActionType] = React.useState<AuditActionType | "all">("all");
  const [actorRole, setActorRole] = React.useState<AuditRole | "all">("all");
  const [actorScope, setActorScope] = React.useState<ActorScope>("all");
  const [sourceTable, setSourceTable] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const sourceTables = React.useMemo(
    () => Array.from(new Set(entries.map((e) => e.sourceTable))).sort(),
    [entries],
  );

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
          q: query || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
        abort,
      )
        .then((res) => {
          setEntries(res.entries);
          setTotal(res.total);
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
    [actionType, actorRole, sourceTable, actorScope, currentUserId, query, page],
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
    exportAuditCsv({
      actionType,
      actorRole,
      sourceTable,
      userId: actorScope === "me" ? currentUserId : undefined,
      q: query || undefined,
    }).catch((err) => console.error("[/api/audit/export] failed:", err));
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Audit Log</h1>
        <p className={styles.subtitle}>
          School-wide record of sensitive actions. Immutable — entries cannot be
          edited or deleted.
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
        sourceTables={sourceTables}
        query={query}
        onQueryChange={(v) => {
          setQuery(v);
          setPage(1);
        }}
        onExport={handleExport}
      />

      {error ? (
        <div className={styles.error}>
          <p>{error}</p>
          <button type="button" className={styles.retry} onClick={handleRetry}>
            Retry
          </button>
        </div>
      ) : loading ? (
        <AuditSkeleton rows={PAGE_SIZE} />
      ) : entries.length === 0 ? (
        <div className={styles.empty}>
          <p>No audit entries match the current filters.</p>
        </div>
      ) : (
        <>
          <AuditTable entries={entries} currentUser={currentUserEmail} />
          <div className={styles.footer}>
            <span className={styles.count}>
              {total} {total === 1 ? "entry" : "entries"}
            </span>
            <AuditPagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </section>
  );
}
