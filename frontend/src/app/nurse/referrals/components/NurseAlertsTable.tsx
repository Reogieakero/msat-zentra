"use client";
import * as React from "react";
import { Inbox, Search, SearchX } from "lucide-react";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import type { NurseAlertItem } from "@/services/nurse/nurse.types";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { NurseReferralEntry, type SessionDialogKind } from "./NurseReferralEntry";
import { NurseActionMenu } from "./NurseActionMenu";
import { NurseActionTabs } from "./NurseActionTabs";
import type { ActionValue, TypeFilter } from "./nurse-referrals-format";
import { NurseCaseKanbanCard } from "./NurseCaseKanbanCard";
import { useNurseAlertFilters } from "./use-nurse-alert-filters";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
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
  layout = "list",
  highlightId = null,
  autoViewFormId = null,
  paginate = true,
  pageSize = PAGE_SIZE,
  serverPage,
  serverTotalPages,
  serverTotal,
  onServerPageChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search cases…",
}: {
  alerts: NurseAlertItem[];
  onChanged: () => void;
  initialType?: TypeFilter;
  lockType?: boolean;
  title?: string;
  /** "kanban" lays the cases out as a folder-card grid (the nurse boards:
      ADM cases / Clinic matters) instead of the one-per-row list feed. */
  layout?: "list" | "kanban";
  highlightId?: string | null;
  autoViewFormId?: string | null;
  paginate?: boolean;
  /** Records per page. Defaults to the global 15; the ADM kanban pages 16. */
  pageSize?: number;
  serverPage?: number;
  serverTotalPages?: number;
  serverTotal?: number;
  serverUnfilteredTotal?: number;
  onServerPageChange?: (p: number) => void;
  /** Server-side search text + change handler — renders the search field in
      the kanban toolbar (right of the action tabs). Omit to hide it. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
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
    safePage,
  } = useNurseAlertFilters({
    alerts,
    initialType,
    highlightId,
    serverDriven,
    serverPage,
    serverTotal,
    serverTotalPages,
    pageSize,
  });
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [sessionDialog, setSessionDialog] = React.useState<{
    row: NurseQueueRow;
    session: NurseSessionItem;
    kind: SessionDialogKind;
  } | null>(null);
  /** Which row's Clinic sessions board is open — owned here so a confirmed
      move/cancel can close both the action dialog and the board together. */
  const [boardRowId, setBoardRowId] = React.useState<string | null>(null);
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
  const hasActiveFilters =
    actionFilter !== "" ||
    (!lockType && typeFilter !== "") ||
    (search ?? "").trim() !== "";
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
  function clearActionFilter() {
    setActionFilter("");
    setPage(1);
    setPaged(true);
  }
  return (
    <div className={styles.layout}>
      <div className={`${styles.feed}${layout === "kanban" ? ` ${styles.feedWide}` : ""}`}>
        {layout === "kanban" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <NurseActionTabs
              actionFilter={actionFilter}
              counts={actionCounts}
              typeFilter={typeFilter}
              onPick={pickAction}
              onClear={clearActionFilter}
            />
            {onSearchChange ? (
              /* 32px tall, 16px radius — the same search field as the
                 alerts board, sitting at the right of the action tabs. */
              <InputGroup className="w-56 max-w-full shrink-0 rounded-[16px]">
                <InputGroupInput
                  placeholder={searchPlaceholder}
                  value={search ?? ""}
                  onChange={(event) => onSearchChange(event.target.value)}
                  aria-label={searchPlaceholder}
                />
                <InputGroupAddon>
                  <Search aria-hidden />
                </InputGroupAddon>
              </InputGroup>
            ) : null}
          </div>
        ) : null}
        {visibleRows.length === 0 ? (
          <NurseEmptyState
            icon={hasActiveFilters ? SearchX : Inbox}
            title={hasActiveFilters ? "No cases match the selected filter" : "You're all caught up"}
            hint={
              hasActiveFilters
                ? layout === "kanban"
                  ? "Pick a different filter above the board, or show every case."
                  : "Pick a different action in the sidebar, or show every case."
                : "New cases sent to you by advisers will appear here."
            }
          />
        ) : layout === "kanban" ? (
          <div className={styles.kanbanGrid} role="list" aria-label={title}>
            {visibleRows.map((alert) => (
              <NurseCaseKanbanCard
                key={alert.key}
                alert={alert}
                highlighted={highlightId !== null && highlightId === alert.row.id}
                now={now}
                boardOpen={boardRowId === alert.row.id}
                onBoardChange={(open) =>
                  setBoardRowId(open ? alert.row.id : null)
                }
                onPreview={setPreviewId}
                onPrivacy={setPrivacyFor}
                onSession={(row, session, kind) => {
                  // Any session action overlay is single-overlay: the Clinic
                  // sessions board behind closes so the Mark session done /
                  // move / cancel dialog is the only thing on screen.
                  setBoardRowId(null);
                  setSessionDialog({ row, session, kind });
                }}
                onDocs={(row, session) => {
                  // Filing/removing docs hands off to the Dock — the Clinic
                  // sessions board behind closes so only one overlay is up.
                  setBoardRowId(null);
                  setDocsFor({ row, session });
                }}
                onSchedule={setScheduleFor}
                onCreateReferral={(row, draft) => setFormSheet({ row, draft })}
                onViewForm={setViewFor}
                onChanged={onChanged}
              />
            ))}
          </div>
        ) : (
          <ol className={styles.cards} aria-label={title}>
            {visibleRows.map((alert) => (
              <NurseReferralEntry
                key={alert.key}
                alert={alert}
                highlighted={highlightId !== null && highlightId === alert.row.id}
                now={now}
                boardOpen={boardRowId === alert.row.id}
                onBoardChange={(open) =>
                  setBoardRowId(open ? alert.row.id : null)
                }
                onPreview={setPreviewId}
                onPrivacy={setPrivacyFor}
                onEndorsedNotice={setEndorsedFor}
                onSession={(row, session, kind) => {
                  setBoardRowId(null);
                  setSessionDialog({ row, session, kind });
                }}
                onDocs={(row, session) => {
                  setBoardRowId(null);
                  setDocsFor({ row, session });
                }}
                onSchedule={setScheduleFor}
                onCreateReferral={(row, draft) => setFormSheet({ row, draft })}
                onViewForm={setViewFor}
                onChanged={onChanged}
              />
            ))}
          </ol>
        )}
        {paginate ? (
          <Pagination
            currentPage={safePage}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={(p) => {
              if (serverDriven) {
                onServerPageChange?.(p);
              } else {
                setPaged(true);
                setPage(p);
              }
            }}
          />
        ) : (
          <ScrollHint count={total} />
        )}
      </div>
      {layout === "kanban" ? null : (
        <NurseActionMenu
          actionFilter={actionFilter}
          counts={actionCounts}
          typeFilter={typeFilter}
          onPick={pickAction}
          onClear={clearActionFilter}
        />
      )}
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
        onSessionConfirmed={() => setBoardRowId(null)}
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
