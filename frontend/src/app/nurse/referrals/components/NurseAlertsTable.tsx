"use client";
import * as React from "react";
import { Inbox, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import type { NurseAlertItem } from "@/services/nurse/nurse.types";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { NurseReferralEntry, type SessionDialogKind } from "./NurseReferralEntry";
import { NurseActionMenu } from "./NurseActionMenu";
import type { ActionValue, TypeFilter } from "./nurse-referrals-format";
import { useNurseAlertFilters } from "./use-nurse-alert-filters";
import { NurseAlertsDialogsHost } from "./nurse-alerts-dialogs-host";
import styles from "./NurseAlertsTable.module.css";
import { useActiveNowTick } from "@/lib/clock";
function ScrollHint({ count }: { count: number }) {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const update = () => {
      if (count === 0) {
        setVisible(false);
        return;
      }
      const el = document.documentElement;
      const scrollable = el.scrollHeight - window.innerHeight > 40;
      const atBottom =
        window.innerHeight + window.scrollY >= el.scrollHeight - 80;
      setVisible(scrollable && !atBottom);
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const t1 = window.setTimeout(update, 0);
    const t2 = window.setTimeout(update, 500);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [count]);
  if (!visible) return null;
  return (
    <div className={styles.scrollHint} aria-hidden="true">
      <span className={styles.scrollHintPill}>
        Scroll for more
        <span className={styles.scrollHintArrow}>↓</span>
      </span>
    </div>
  );
}
export function NurseAlertsTable({
  alerts,
  onChanged,
  initialType = "",
  lockType = false,
  title = "Referrals to me",
  highlightId = null,
  autoViewFormId = null,
  paginate = true,
  serverPage,
  serverTotalPages,
  serverTotal,
  serverUnfilteredTotal,
  onServerPageChange,
}: {
  alerts: NurseAlertItem[];
  onChanged: () => void;
  initialType?: TypeFilter;
  lockType?: boolean;
  title?: string;
  highlightId?: string | null;
  autoViewFormId?: string | null;
  paginate?: boolean;
  serverPage?: number;
  serverTotalPages?: number;
  serverTotal?: number;
  serverUnfilteredTotal?: number;
  onServerPageChange?: (p: number) => void;
}) {
  const serverDriven = serverTotalPages !== undefined;
  const {
    typeFilter,
    setTypeFilter,
    actionFilter,
    setActionFilter,
    setPage,
    setPaged,
    effPage,
    filtered,
    actionCounts,
    total,
    totalPages,
    safePage,
    pageSize,
  } = useNurseAlertFilters({
    alerts,
    initialType,
    highlightId,
    serverDriven,
    serverPage,
    serverTotal,
    serverTotalPages,
  });
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [sessionDialog, setSessionDialog] = React.useState<{
    row: NurseQueueRow;
    session: NurseSessionItem;
    kind: SessionDialogKind;
  } | null>(null);
  const [scheduleFor, setScheduleFor] = React.useState<NurseQueueRow | null>(null);
  const [docsFor, setDocsFor] = React.useState<{
    row: NurseQueueRow;
    session: NurseSessionItem;
  } | null>(null);
  const [formSheet, setFormSheet] = React.useState<{
    row: NurseQueueRow;
    draft: AdmReviewDraft;
  } | null>(null);
  const [viewFor, setViewFor] = React.useState<NurseQueueRow | null>(null);
  React.useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`nurse-case-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, effPage, alerts]);
  const [formDismissed, setFormDismissed] = React.useState(false);
  const autoRow = React.useMemo(
    () =>
      autoViewFormId
        ? (alerts.find((a) => a.row.id === autoViewFormId)?.row ?? null)
        : null,
    [alerts, autoViewFormId]
  );
  const effectiveViewFor = !formDismissed ? (viewFor ?? autoRow) : viewFor;
  const visibleRows = serverDriven || !paginate
    ? filtered
    : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasScheduledOnPage = visibleRows.some((a) =>
    a.row.sessions.some((s) => s.status === "scheduled")
  );
  const now = useActiveNowTick(hasScheduledOnPage);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const hasActiveFilters =
    actionFilter !== "" || (!lockType && typeFilter !== "");
  function pickAction(value: ActionValue, type: "ADM" | "Clinic") {
    if (!lockType) setTypeFilter(type);
    setActionFilter((prev) => (prev === value ? "" : value));
    if (serverDriven) {
      onServerPageChange?.(1);
    } else {
      setPage(1);
      setPaged(true);
    }
  }
  return (
    <div className={styles.layout}>
      <div className={styles.feed}>
        {visibleRows.length === 0 ? (
          <NurseEmptyState
            icon={hasActiveFilters ? SearchX : Inbox}
            title={hasActiveFilters ? "No cases match the selected filter" : "You're all caught up"}
            hint={
              hasActiveFilters
                ? "Pick a different action in the sidebar, or show every case."
                : "New cases sent to you by advisers will appear here."
            }
          />
        ) : (
          <ol className={styles.cards} aria-label={title}>
            {visibleRows.map((alert) => (
              <NurseReferralEntry
                key={alert.key}
                alert={alert}
                highlighted={highlightId !== null && highlightId === alert.row.id}
                now={now}
                onPreview={setPreviewId}
                onPrivacy={setPrivacyFor}
                onEndorsedNotice={setEndorsedFor}
                onSession={(row, session, kind) => setSessionDialog({ row, session, kind })}
                onDocs={(row, session) => setDocsFor({ row, session })}
                onSchedule={setScheduleFor}
                onCreateReferral={(row, draft) => setFormSheet({ row, draft })}
                onViewForm={setViewFor}
                onChanged={onChanged}
              />
            ))}
          </ol>
        )}
        {paginate && totalPages > 1 ? (
          <nav className={styles.pager} aria-label="Cases pages">
            <p className={styles.range}>
              Showing {start}–{end} of {total}
              {serverDriven &&
              serverUnfilteredTotal !== undefined &&
              serverUnfilteredTotal !== total
                ? ` (of ${serverUnfilteredTotal} on your desk)`
                : ""}
            </p>
            <div className={styles.pagerButtons}>
              <Button
                size="xs"
                variant="outline"
                disabled={safePage <= 1}
                onClick={() => {
                  if (serverDriven) {
                    onServerPageChange?.(Math.max(1, safePage - 1));
                  } else {
                    setPaged(true);
                    setPage(Math.max(1, safePage - 1));
                  }
                }}
              >
                Previous
              </Button>
              <span className={styles.pageLabel} aria-live="polite">
                Page {safePage} of {totalPages}
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={safePage >= totalPages}
                onClick={() => {
                  if (serverDriven) {
                    onServerPageChange?.(safePage + 1);
                  } else {
                    setPaged(true);
                    setPage(safePage + 1);
                  }
                }}
              >
                Next
              </Button>
            </div>
          </nav>
        ) : (
          <ScrollHint count={total} />
        )}
      </div>
      <NurseActionMenu
        actionFilter={actionFilter}
        counts={actionCounts}
        typeFilter={typeFilter}
        onPick={pickAction}
        onClear={() => {
          setActionFilter("");
          setPage(1);
          setPaged(true);
        }}
      />
      <NurseAlertsDialogsHost
        previewId={previewId}
        onPreviewClose={() => setPreviewId(null)}
        privacyFor={privacyFor}
        onPrivacyClose={() => setPrivacyFor(null)}
        endorsedFor={endorsedFor}
        onEndorsedClose={() => setEndorsedFor(null)}
        scheduleFor={scheduleFor}
        onScheduleClose={() => setScheduleFor(null)}
        onChanged={onChanged}
        sessionDialog={sessionDialog}
        onSessionClose={() => setSessionDialog(null)}
        docsFor={docsFor}
        onDocsClose={() => setDocsFor(null)}
        formSheet={formSheet}
        onFormSheetClose={() => setFormSheet(null)}
        effectiveViewFor={effectiveViewFor}
        onViewClose={() => {
          setViewFor(null);
          setFormDismissed(true);
        }}
      />
    </div>
  );
}
