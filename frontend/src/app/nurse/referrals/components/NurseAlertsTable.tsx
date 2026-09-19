"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "../../overview/components/nurse-overview-data";
import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { NurseAdmReferralFormSheet } from "./NurseAdmReferralFormSheet";
import {
  CancelSessionDialog,
  DeleteSessionDialog,
  FinishSessionDialog,
  MoveSessionDialog,
  NurseReferralFormViewModal,
  ScheduleSessionDialog,
  SessionDocsDialog,
} from "./NurseReferralDialogs";
import { NurseReferralEntry, type SessionDialogKind } from "./NurseReferralEntry";
import { NurseActionMenu } from "./NurseActionMenu";
import {
  TYPES,
  isEndorsed,
  matchesActionFilter,
  type ActionFilter,
  type ActionValue,
  type TypeFilter,
} from "./nurse-referrals-format";
import styles from "./NurseAlertsTable.module.css";

const PAGE_SIZE = 8;

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

/**
 * Cases sent to the nurse (clinic matters and ADM consultations), newest
 * first — toolbar with count + filters, alternating timeline entries, an
 * action-menu sidebar, and a pager.
 *
 * Separate pages lock to one type (ADM Cases / Clinic Matters) via
 * `initialType` + `lockType` so the reader never needs the case-type
 * dropdown — the timeline, action menu, and counts all stay on that type.
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
}: {
  alerts: NurseAlertItem[];
  onChanged: () => void;
  initialType?: TypeFilter;
  lockType?: boolean;
  title?: string;
  highlightId?: string | null;
  autoViewFormId?: string | null;
}) {
  const [query, setQuery] = React.useState("");
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
  const effPage = !paged && highlightPage !== null ? highlightPage : page;

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
    const q = query.trim().toLowerCase();
    const rows = alerts.filter((a) => {
      if (typeFilter !== "" && a.row.type !== typeFilter) return false;
      // Sidebar action menu — narrows the timeline to cases of the picked
      // type in the picked action state.
      if (actionFilter !== "" && !matchesActionFilter(a.row, actionFilter)) return false;
      if (
        q !== "" &&
        !`${a.row.student} ${a.row.lrn} ${a.row.section} ${a.row.reason} ${a.row.anecdotal?.incident ?? ""} ${a.row.category}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    // Latest referred on top — the referrals queue is a newest-first
    // timeline (page 1 = newest, pager walks toward older cases).
    rows.sort((a, b) => {
      const aDate = a.row.date === "—" ? "" : a.row.date;
      const bDate = b.row.date === "—" ? "" : b.row.date;
      const dateCmp = bDate.localeCompare(aDate);
      if (dateCmp !== 0) return dateCmp;
      return b.sortTime - a.sortTime;
    });
    return rows;
  }, [alerts, query, typeFilter, actionFilter]);

  // Action-menu counts — computed from the full desk so the numbers stay
  // stable while searching or paging. ADM and Clinic menus count only
  // their own type.
  const actionCounts = React.useMemo(() => {
    const counts: Record<ActionValue, number> = {
      adm_needs: 0,
      endorse: 0,
      followup: 0,
      booked: 0,
      reject: 0,
      clinic_needs: 0,
      clinic_booked: 0,
      clinic_done: 0,
      clinic_followup: 0,
    };
    for (const a of alerts) {
      if (a.row.type === "ADM") {
        if (a.row.status === "pending") counts.adm_needs += 1;
        if (isEndorsed(a.row.type, a.row.status)) counts.endorse += 1;
        if (a.row.status === "follow_up") counts.followup += 1;
        if (a.row.sessions.length > 0) counts.booked += 1;
        if (a.row.status === "dismissed") counts.reject += 1;
      } else if (a.row.type === "Clinic") {
        if (a.row.status === "pending") counts.clinic_needs += 1;
        if (a.row.sessions.length > 0) counts.clinic_booked += 1;
        if (a.row.sessions.some((s) => s.status === "completed")) counts.clinic_done += 1;
        if (a.row.status === "follow_up") counts.clinic_followup += 1;
      }
    }
    return counts;
  }, [alerts]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(effPage, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // One live clock for every countdown on this page — ticks each second
  // only while a scheduled session is visible, so seconds stay exact.
  const hasScheduledOnPage = pageRows.some((a) =>
    a.row.sessions.some((s) => s.status === "scheduled")
  );
  const now = useNowTick(hasScheduledOnPage);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const hasActiveFilters =
    query.trim() !== "" ||
    actionFilter !== "" ||
    (!lockType && typeFilter !== "");
  const typeFilterLabel =
    TYPES.find((t) => t.value === typeFilter)?.label ?? "All types";

  function clearFilters() {
    // Locked pages stay on their type — clearing only resets the search
    // and the action menu so the timeline never empties to the other type.
    // Either way the reader takes over paging from here.
    if (!lockType) setTypeFilter("");
    setActionFilter("");
    setPage(1);
    setPaged(true);
  }

  function pickAction(value: ActionValue, type: "ADM" | "Clinic") {
    // Locked pages never switch type — picking an action only toggles the
    // action state within the page's own type.
    if (!lockType) setTypeFilter(type);
    setActionFilter((prev) => (prev === value ? "" : value));
    setPage(1);
    setPaged(true);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.feed}>
        <div className={styles.toolbar}>
          <div>
            <h1 className={styles.title}>{title}</h1>
          </div>
          <div className={styles.filters}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.search}
                style={{ height: "1.75rem" }}
                placeholder="Search by student name or keyword…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Search your cases"
              />
            </div>

            {!lockType && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Filter cases by type, currently showing: ${typeFilterLabel}`}
                    className={`${styles.filterBtn} ${typeFilter !== "" ? styles.filterActive : ""}`}
                  >
                    {typeFilterLabel}
                    {typeFilter !== "" && <span className={styles.filterDot} aria-hidden />}
                    <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={styles.filterMenu}>
                  {TYPES.map((item) => (
                    <DropdownMenuCheckboxItem
                      key={item.label}
                      checked={typeFilter === item.value}
                      onCheckedChange={() => {
                        setTypeFilter(item.value);
                        // The sidebar menus are per-type — a stale action from
                        // the other type would empty the list, so reset it.
                        setActionFilter("");
                        setPage(1);
                      }}
                    >
                      {item.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className={styles.clearBtn}
                onClick={clearFilters}
              >
                <X aria-hidden />
                Show all
              </Button>
            )}
          </div>
        </div>

        {pageRows.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {hasActiveFilters ? "No cases match your search" : "You're all caught up"}
            </p>
            <p className={styles.emptyHint}>
              {hasActiveFilters
                ? "Try a different name or keyword, or clear the filter to see every case."
                : "New cases sent to you by advisers will appear here."}
            </p>
          </div>
        ) : (
          <ol className={styles.timeline}>
            {pageRows.map((alert, index) => (
              <NurseReferralEntry
                key={alert.key}
                alert={alert}
                alt={index % 2 === 1}
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

        {/* Pager */}
        <nav className={styles.pager} aria-label="Cases pages">
          <p className={styles.range}>
            Showing {start}–{end} of {total}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="xs"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => {
                setPaged(true);
                setPage(Math.max(1, safePage - 1));
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
                setPaged(true);
                setPage(safePage + 1);
              }}
            >
              Next
            </Button>
          </div>
        </nav>
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
