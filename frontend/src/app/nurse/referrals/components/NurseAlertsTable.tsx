"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import type { NurseAlertItem } from "@/services/nurse/nurse.types";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { NurseAdmReferralFormSheet } from "./NurseAdmReferralFormSheet";
import {
  CancelSessionDialog,
  DeleteSessionDialog,
  FinishSessionDialog,
  MoveSessionDialog,
  ScheduleSessionDialog,
} from "./NurseSessionDialogs";
import { NurseReferralFormViewModal } from "./NurseCaseDialogs";
import { SessionDocsDialog } from "./SessionDocsDialog";
import { NurseReferralEntry, type SessionDialogKind } from "./NurseReferralEntry";
import { NurseActionMenu } from "./NurseActionMenu";
import {
  isEndorsed,
  isWithdrawn,
  matchesActionFilter,
  type ActionFilter,
  type ActionValue,
  type TypeFilter,
} from "./nurse-referrals-format";
import styles from "./NurseAlertsTable.module.css";

const PAGE_SIZE = 15;

/* Live clock for the countdowns — ticks every second while any scheduled
   session is on screen so the seconds stay exact. */
function useNowTick(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/* Scroll hint — a floating "scroll for more" pill shown only while the
   page itself is scrollable and the reader hasn't reached the bottom.
   Rendered instead of the pager on unpaginated feeds (clinic matters). */
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
    // Measure after paint (and again once content settles) — async so the
    // effect itself never sets state synchronously.
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

/**
 * Cases sent to the nurse (clinic matters and ADM consultations), newest
 * first — toolbar with count + filters, alternating timeline entries, an
 * action-menu sidebar, and a pager.
 *
 * Separate pages lock to one type (ADM Cases / Clinic Matters) via
 * `initialType` + `lockType` so the reader never needs the case-type
 * dropdown — the timeline, action menu, and counts all stay on that type.
 *
 * Pass `paginate={false}` for a single scrolling feed with no pager UI —
 * a scroll hint appears only while the contents actually overflow.
 *
 * Deep-links from the alerts table pass `highlightId` (scrolls to and
 * highlights the case, jumping the pager to its page) and optionally
 * `autoViewFormId` (overlays the filled referral form on arrival).
 */
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
  /** Server-driven pager (?track=&page=&pageSize=15). When present the
      backend owns pagination + highlight landing; the sidebar action menu
      stays a client facet on the served page rows. */
  serverPage?: number;
  serverTotalPages?: number;
  /** Filtered pager count (server total). */
  serverTotal?: number;
  /** UNFILTERED desk total — menu counts never shrink the pager. */
  serverUnfilteredTotal?: number;
  onServerPageChange?: (p: number) => void;
}) {
  const serverDriven = serverTotalPages !== undefined;
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>(initialType);
  const [actionFilter, setActionFilter] = React.useState<ActionFilter>("");
  const [page, setPage] = React.useState(1);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);
  const [endorsedFor, setEndorsedFor] = React.useState<string | null>(null);
  const [sessionDialog, setSessionDialog] = React.useState<{
    row: NurseQueueRow;
    session: NurseSessionItem;
    kind: SessionDialogKind;
  } | null>(null);
  // Clinic session booking target — the referrals page had finish/move/
  // cancel/delete but no way to create a session until now.
  const [scheduleFor, setScheduleFor] = React.useState<NurseQueueRow | null>(null);
  const [docsFor, setDocsFor] = React.useState<{
    row: NurseQueueRow;
    session: NurseSessionItem;
  } | null>(null);
  // Fill-up form sheet target — opened from the review dialog's Create
  // referral handoff (in place, no navigation).
  const [formSheet, setFormSheet] = React.useState<{
    row: NurseQueueRow;
    draft: AdmReviewDraft;
  } | null>(null);
  const [viewFor, setViewFor] = React.useState<NurseQueueRow | null>(null);
  // Deep-link arrival: the highlighted case's page (fresh mounts start
  // unfiltered, so the index is over the full newest-first list). Derived
  // during render — no effect — and yields to the pager once the reader
  // navigates or filters.
  const [paged, setPaged] = React.useState(false);
  const highlightPage = React.useMemo(() => {
    if (!highlightId || alerts.length === 0) return null;
    const sorted = [...alerts].sort((a, b) => {
      const aDate = a.row.date === "—" ? "" : a.row.date;
      const bDate = b.row.date === "—" ? "" : b.row.date;
      const dateCmp = bDate.localeCompare(aDate);
      if (dateCmp !== 0) return dateCmp;
      return b.sortTime - a.sortTime;
    });
    const idx = sorted.findIndex((a) => a.row.id === highlightId);
    return idx >= 0 ? Math.floor(idx / PAGE_SIZE) + 1 : null;
  }, [alerts, highlightId]);
  // Server-driven pages land the highlight's page server-side (?highlight=),
  // so the client jump only applies to full-list mode.
  const effPage = serverDriven
    ? (serverPage ?? 1)
    : !paged && highlightPage !== null
      ? highlightPage
      : page;

  // Scroll the highlighted case into view once its page renders.
  React.useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`nurse-case-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, effPage, alerts]);

  // Overlay the filled referral form on arrival ("View referral form") —
  // derived during render; dismissing sticks via formDismissed.
  const [formDismissed, setFormDismissed] = React.useState(false);
  const autoRow = React.useMemo(
    () =>
      autoViewFormId
        ? (alerts.find((a) => a.row.id === autoViewFormId)?.row ?? null)
        : null,
    [alerts, autoViewFormId]
  );
  const effectiveViewFor = !formDismissed ? (viewFor ?? autoRow) : viewFor;

  const filtered = React.useMemo(() => {
    const rows = alerts.filter((a) => {
      if (typeFilter !== "" && a.row.type !== typeFilter) return false;
      // Sidebar action menu — narrows the list to cases of the picked
      // type in the picked action state.
      if (actionFilter !== "" && !matchesActionFilter(a.row, actionFilter)) return false;
      return true;
    });
    // Latest referred on top — the referrals queue is a newest-first
    // list (page 1 = newest, pager walks toward older cases).
    rows.sort((a, b) => {
      const aDate = a.row.date === "—" ? "" : a.row.date;
      const bDate = b.row.date === "—" ? "" : b.row.date;
      const dateCmp = bDate.localeCompare(aDate);
      if (dateCmp !== 0) return dateCmp;
      return b.sortTime - a.sortTime;
    });
    return rows;
  }, [alerts, typeFilter, actionFilter]);

  // Action-menu counts — computed from the served rows (full desk in
  // full-list mode, current server page when server-driven) so the numbers
  // stay stable while paging. ADM and Clinic menus count only their own
  // type.
  const actionCounts = React.useMemo(() => {
    const counts: Record<ActionValue, number> = {
      adm_needs: 0,
      endorse: 0,
      followup: 0,
      booked: 0,
      reject: 0,
      adm_cancelled: 0,
      clinic_needs: 0,
      clinic_booked: 0,
      clinic_done: 0,
      clinic_followup: 0,
      clinic_cancelled: 0,
    };
    for (const a of alerts) {
      if (a.row.type === "ADM") {
        if (a.row.status === "pending") counts.adm_needs += 1;
        if (isEndorsed(a.row.type, a.row.status)) counts.endorse += 1;
        if (a.row.status === "follow_up") counts.followup += 1;
        if (a.row.sessions.length > 0) counts.booked += 1;
        if (a.row.status === "dismissed" && !isWithdrawn(a.row)) counts.reject += 1;
        if (isWithdrawn(a.row)) counts.adm_cancelled += 1;
      } else if (a.row.type === "Clinic") {
        if (a.row.status === "pending") counts.clinic_needs += 1;
        if (a.row.sessions.length > 0) counts.clinic_booked += 1;
        if (a.row.sessions.some((s) => s.status === "completed")) counts.clinic_done += 1;
        if (a.row.status === "follow_up") counts.clinic_followup += 1;
        if (isWithdrawn(a.row)) counts.clinic_cancelled += 1;
      }
    }
    return counts;
  }, [alerts]);

  // Filtered pager count comes from the server when server-driven
  // (UNFILTERED menu counts live beside it, never shrinking the pager).
  const total = serverDriven ? (serverTotal ?? filtered.length) : filtered.length;
  const totalPages = serverDriven
    ? Math.max(1, serverTotalPages ?? 1)
    : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(effPage, totalPages);
  const visibleRows = serverDriven || !paginate
    ? filtered
    : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // One live clock for every countdown on screen — ticks each second
  // only while a scheduled session is visible, so seconds stay exact.
  const hasScheduledOnPage = visibleRows.some((a) =>
    a.row.sessions.some((s) => s.status === "scheduled")
  );
  const now = useNowTick(hasScheduledOnPage);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const hasActiveFilters =
    actionFilter !== "" || (!lockType && typeFilter !== "");

  function pickAction(value: ActionValue, type: "ADM" | "Clinic") {
    // Locked pages never switch type — picking an action only toggles the
    // action state within the page's own type.
    if (!lockType) setTypeFilter(type);
    setActionFilter((prev) => (prev === value ? "" : value));
    if (serverDriven) {
      // Facet restarts on the first server page (event-driven, no effects).
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
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {hasActiveFilters ? "No cases match the selected filter" : "You're all caught up"}
            </p>
            <p className={styles.emptyHint}>
              {hasActiveFilters
                ? "Pick a different action in the sidebar, or show every case."
                : "New cases sent to you by advisers will appear here."}
            </p>
          </div>
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

        {/* Pager — unpaginated feeds render the scroll hint instead. */}
        {paginate ? (
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

      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />

      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={() => setPrivacyFor(null)}
        studentName={privacyFor ?? undefined}
      />

      <PrivacyNoticeDialog
        open={endorsedFor !== null}
        onClose={() => setEndorsedFor(null)}
        studentName={endorsedFor ?? undefined}
        reason="endorsed"
      />

      {scheduleFor && (
        <ScheduleSessionDialog
          row={scheduleFor}
          open
          onClose={() => setScheduleFor(null)}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "finish" && (        <FinishSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          open
          onClose={() => setSessionDialog(null)}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "move" && (
        <MoveSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          open
          onClose={() => setSessionDialog(null)}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "cancel" && (
        <CancelSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          open
          onClose={() => setSessionDialog(null)}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "delete" && (
        <DeleteSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          open
          onClose={() => setSessionDialog(null)}
          onChanged={onChanged}
        />
      )}
      {docsFor && (
        <SessionDocsDialog
          referralId={docsFor.row.id}
          session={docsFor.session}
          open
          onClose={() => setDocsFor(null)}
          onChanged={onChanged}
        />
      )}
      {formSheet && (
        <NurseAdmReferralFormSheet
          open
          onClose={() => setFormSheet(null)}
          row={formSheet.row}
          initialDraft={formSheet.draft}
          onChanged={onChanged}
        />
      )}
      {effectiveViewFor && (
        <NurseReferralFormViewModal
          key={effectiveViewFor.id}
          row={effectiveViewFor}
          open
          onClose={() => {
            setViewFor(null);
            setFormDismissed(true);
          }}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
