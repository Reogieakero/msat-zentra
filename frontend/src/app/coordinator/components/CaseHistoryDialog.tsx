"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchCaseHistory,
  friendlyReason,
  type AdmCaseRow,
} from "./coordinator-data";
import { roleLabel } from "@/lib/auth/roles";
import pageStyles from "../pages.module.css";

export interface HistoryTarget {
  title: string;
  profileId?: string;
  referralId?: string;
}

export function historyTargetFor(row: AdmCaseRow): HistoryTarget {
  if (row.id.startsWith("referral:")) {
    return { title: row.student, referralId: row.id.replace(/^referral:/, "") };
  }
  return { title: row.student, profileId: row.id };
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}

/**
 * Case history timeline — audit-trail events across the learner profile,
 * its source referral, and its devices. System events only (actor, action,
 * reason), never clinical write-ups.
 */
export function CaseHistoryDialog({
  target,
  onClose,
}: {
  target: HistoryTarget | null;
  onClose: () => void;
}) {
  const historyQuery = useQuery({
    queryKey: [
      "coordinator-history",
      target?.profileId ?? null,
      target?.referralId ?? null,
    ],
    queryFn: ({ signal }) =>
      fetchCaseHistory(
        { profileId: target?.profileId, referralId: target?.referralId },
        signal,
      ),
    enabled: target !== null,
    staleTime: 30_000,
  });

  const events = historyQuery.data ?? [];

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent style={{ maxWidth: "32rem" }}>
        <DialogHeader>
          <DialogTitle>Case history</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                Every recorded event for {target.title}, oldest first.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {historyQuery.isPending ? (
          <ol
            className={pageStyles.historyList}
            aria-busy="true"
            aria-label="Loading case history"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className={pageStyles.historyItem} aria-hidden="true">
                <span className={pageStyles.historyDot} aria-hidden />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Skeleton style={{ width: "70%", height: "0.875rem" }} />
                  <Skeleton
                    style={{
                      width: "45%",
                      height: "0.75rem",
                      marginTop: "0.375rem",
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : historyQuery.isError ? (
          <div className={pageStyles.errorBlock} role="alert">
            <p className={pageStyles.errorText}>
              We couldn&apos;t load the history. Please try again.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={historyQuery.isRefetching}
              onClick={() => historyQuery.refetch()}
            >
              {historyQuery.isRefetching ? <Loader2 className={pageStyles.spin} aria-hidden="true" /> : null}
              {historyQuery.isRefetching ? "Loading…" : "Try again"}
            </Button>
          </div>
        ) : events.length === 0 ? (
          <p className={pageStyles.emptyText}>No recorded events yet.</p>
        ) : (
          <ol className={pageStyles.historyList}>
            {events.map((e) => (
              <li key={e.id} className={pageStyles.historyItem}>
                <span className={pageStyles.historyDot} aria-hidden />
                <div style={{ minWidth: 0 }}>
                  <p className={pageStyles.historyItemTitle}>
                    {friendlyReason(e.reason, e.actionType)}
                  </p>
                  <p className={pageStyles.historyItemSub}>
                    {e.actor} · {roleLabel(e.actorRole)} · {formatTimestamp(e.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
