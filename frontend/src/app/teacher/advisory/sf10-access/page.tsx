"use client";

import * as React from "react";
import { ShieldQuestion } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { TeacherEmptyCard } from "../../components/TeacherEmptyCard";
import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvisoryRoster } from "@/services/teacher/advisory.service";
import {
  fetchMyVerification,
  useMyAccessRequests,
  useMyVerification,
  type HasRow,
} from "@/services/teacher/sf10Access.service";
import { Sf10RepoFolders } from "./components/Sf10RepoFolders";
import { RejectedRequestsCard, Sf10MissingCard, Sf10Sidebar } from "./components/Sf10SideRail";
import styles from "./components/sf10-repo.module.css";

function isSpreadsheetUrl(url: string): boolean {
  const ext = (() => {
    try {
      const pathname = new URL(url).pathname;
      return pathname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    } catch {
      return url.split("?")[0].split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    }
  })();
  return ext === "xlsx" || ext === "xls";
}

export default function TeacherSf10AccessPage() {
  const rosterQuery = useAdvisoryRoster();
  const requestsQuery = useMyAccessRequests(!!rosterQuery.data);
  const requests = React.useMemo(() => requestsQuery.data ?? [], [requestsQuery.data]);

  const activeRequest = React.useMemo(() => {
    if (requests.length === 0) return null;
    return (
      requests.find((r) => r.status === "approved") ??
      requests.find((r) => r.status === "pending") ??
      requests[0]
    );
  }, [requests]);

  const verification = useMyVerification(activeRequest?.id ?? null);

  // One kanban board across EVERY request for the section: a repeat request
  // (nth time, any status) unions its granted folders here, so an earlier
  // board is never hidden behind the newest request. Grants are per-student
  // (bulk "approve all" leaves the request pending), and only rows flagged
  // approved are collected. Nothing is deleted — the server only inserts
  // requests and grants additively.
  const unionRequestIds = React.useMemo(
    () => [...new Set(requests.map((r) => r.id))],
    [requests],
  );
  const unionVerifications = useQueries({
    queries: unionRequestIds.map((id) => ({
      queryKey: ["teacher-sf10-access", id, "records"],
      queryFn: () => fetchMyVerification(id),
      staleTime: 30_000,
    })),
  });
  const grantedRows = React.useMemo(() => {
    const byLrn = new Map<string, HasRow>();
    for (const q of unionVerifications) {
      for (const row of q.data?.hasSf10 ?? []) {
        if (row.approved && !byLrn.has(row.lrn)) byLrn.set(row.lrn, row);
      }
    }
    return [...byLrn.values()];
  }, [unionVerifications]);
  const foldersPending =
    verification.isPending || unionVerifications.some((q) => q.isPending);
  const foldersError =
    verification.isError || unionVerifications.some((q) => q.isError);

  const [query, setQuery] = React.useState("");

  // View-only: opens the file in a new tab rendered inline (never saved).
  // Public storage URLs carry the upload content type and serve inline, so a
  // synchronous direct open renders PDFs/images in the tab — no fetch, no
  // download. Spreadsheets can't render natively, so they go through the
  // Office viewer. Synchronous so popup blockers allow it (the old
  // open-blank-then-fetch dance left about:blank tabs behind blockers).
  const handleViewInNewTab = React.useCallback((fileUrl: string) => {
    if (!fileUrl) return;
    const target = isSpreadsheetUrl(fileUrl)
      ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`
      : fileUrl;
    const win = window.open(target, "_blank", "noopener,noreferrer");
    if (!win) {
      toast.error({ title: "Popup blocked", description: "Allow popups for this site, then try again." });
    }
  }, []);

  const missingRows = React.useMemo(
    () => verification.data?.missingSf10 ?? [],
    [verification.data],
  );
  const deniedRequests = React.useMemo(
    () => requests.filter((r) => r.status === "denied"),
    [requests],
  );
  const matchesQuery = React.useCallback(
    (lrn: string, name: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return lrn.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    },
    [query],
  );
  // Folder UI: every student granted SF10 read across all requests.
  const approvedFolders = React.useMemo(
    () => grantedRows.filter((r) => matchesQuery(r.lrn, r.name)),
    [grantedRows, matchesQuery],
  );
  // Viewable when any contributing request grants download/edit (identical
  // to the active request in the single-request case).
  const unionCanAct = unionVerifications.some(
    (q) => q.data?.canDownload && q.data?.canEdit,
  );
  const filteredMissing = React.useMemo(
    () => missingRows.filter((r) => matchesQuery(r.lrn, r.name)),
    [missingRows, matchesQuery],
  );

  if (rosterQuery.isPending || requestsQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading SF10 access">
        <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
          <div className={`${styles.main} flex min-w-0 flex-col`}>
            <div className={styles.skelPanel} aria-hidden>
              <Skeleton className={styles.skelPanelTitle} />
              <Skeleton className={styles.skelPanelDesc} />
              <div className={styles.skelActions}>
                <Skeleton className={styles.skelSearch} />
              </div>
              <div className={styles.skelFolderGrid}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex min-w-0 flex-col gap-2">
                    <Skeleton className={styles.skelFolder} />
                    <Skeleton className={styles.skelFolderLabel} />
                    <Skeleton className={styles.skelFolderSub} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden min-w-0 flex-col items-end gap-2 lg:flex" aria-hidden>
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      </section>
    );
  }

  if (rosterQuery.isError) {
    return (
      <section className={styles.page} aria-label="SF10 access">
        <TeacherEmptyCard
          centered
          icon={ShieldQuestion}
          title="No advisory section assigned"
          hint="No advisory section assigned, or it could not be loaded. Contact the school office."
          label="SF10 access"
        />
      </section>
    );
  }

  return (
    <section className={styles.page} aria-label="SF10 access">
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_2.75rem]">
        <div className={`${styles.main} flex min-w-0 flex-col`}>
          <Sf10RepoFolders
            rows={approvedFolders}
            totalCount={grantedRows.length}
            query={query}
            onQueryChange={setQuery}
            canAct={unionCanAct}
            pending={foldersPending}
            error={foldersError}
            denied={activeRequest?.status === "denied"}
            onOpen={handleViewInNewTab}
          />
        </div>
        <Sf10Sidebar
          requests={deniedRequests}
          rows={filteredMissing}
          pending={verification.isPending}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:hidden">
        <RejectedRequestsCard requests={deniedRequests} />
        <Sf10MissingCard rows={filteredMissing} pending={verification.isPending} />
      </div>
    </section>
  );
}
