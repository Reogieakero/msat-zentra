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
import type { NurseReferralDraft } from "../../overview/components/nurse-overview-data";
import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import {
  CancelSessionDialog,
  DeleteSessionDialog,
  FinishSessionDialog,
  MoveSessionDialog,
  NurseReferralFormModal,
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
 */
export function NurseAlertsTable({
  alerts,
  onChanged,
}: {
  alerts: NurseAlertItem[];
  onChanged: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("");
  const [actionFilter, setActionFilter] = React.useState<ActionFilter>("");
  const [page, setPage] = React.useState(1);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);
  const [sessionDialog, setSessionDialog] = React.useState<{
    row: NurseQueueRow;
    session: NurseSessionItem;
    kind: SessionDialogKind;
  } | null>(null);
  const [docsFor, setDocsFor] = React.useState<{
    row: NurseQueueRow;
    session: NurseSessionItem;
  } | null>(null);
  // Clinic "Book session" target — opens the schedule dialog. Kept
  // separate from sessionDialog (per-session actions) on purpose.
  const [bookFor, setBookFor] = React.useState<NurseQueueRow | null>(null);
  const [formModal, setFormModal] = React.useState<{
    row: NurseQueueRow;
    draft?: NurseReferralDraft;
  } | null>(null);
  const [viewFor, setViewFor] = React.useState<NurseQueueRow | null>(null);

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
  const safePage = Math.min(page, totalPages);
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
    query.trim() !== "" || typeFilter !== "" || actionFilter !== "";
  const typeFilterLabel =
    TYPES.find((t) => t.value === typeFilter)?.label ?? "All types";

  function clearFilters() {
    setTypeFilter("");
    setActionFilter("");
    setPage(1);
  }

  function pickAction(value: ActionValue, type: "ADM" | "Clinic") {
    setTypeFilter(type);
    setActionFilter((prev) => (prev === value ? "" : value));
    setPage(1);
  }

  return (
    <div className={styles.layout}>
      <div className={styles.feed}>
        <div className={styles.toolbar}>
          <div>
            <h1 className={styles.title}>Referrals to me</h1>
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
                now={now}
                onPreview={setPreviewId}
                onPrivacy={setPrivacyFor}
                onSession={(row, session, kind) => setSessionDialog({ row, session, kind })}
                onDocs={(row, session) => setDocsFor({ row, session })}
                onBook={setBookFor}
                onCreateReferral={(row, draft) => setFormModal({ row, draft })}
                onViewForm={setViewFor}
                onChanged={onChanged}
              />
            ))}
          </ol>
        )}

        {/* Pager */}
        <nav className={styles.pager} aria-label="Cases pages">
          <p className={styles.range}>
            Showing cases {start}–{end} of {total}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Show newer cases"
            >
              ← Newer
            </Button>
            <span className={styles.pageLabel} aria-live="polite">
              Page {safePage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Show older cases"
            >
              Older →
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
        }}
      />

      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />

      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={() => setPrivacyFor(null)}
        studentName={privacyFor ?? undefined}
      />

      {sessionDialog && sessionDialog.kind === "finish" && (
        <FinishSessionDialog
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
      {bookFor && (
        <ScheduleSessionDialog
          referralId={bookFor.id}
          student={bookFor.student}
          sessions={bookFor.sessions}
          open
          onClose={() => setBookFor(null)}
          onChanged={onChanged}
        />
      )}
      {formModal && (
        <NurseReferralFormModal
          row={formModal.row}
          initialRecommendation={formModal.draft?.recommendation ?? ""}
          initialScheduledAt={formModal.draft?.scheduledAt}
          open
          onClose={() => setFormModal(null)}
          onChanged={onChanged}
        />
      )}
      {viewFor && (
        <NurseReferralFormViewModal
          key={viewFor.id}
          row={viewFor}
          open
          onClose={() => setViewFor(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
