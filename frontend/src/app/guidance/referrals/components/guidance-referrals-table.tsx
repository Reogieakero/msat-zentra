"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  GuidanceReferralItem,
  GuidanceReferralsSummary,
} from "@/services/guidance/guidance.types";
import {
  GuidanceReferralDialogs,
} from "./GuidanceReferralDialogs";
import { useGuidanceReferralActions } from "./use-guidance-referral-actions";
import {
  GuidanceReferralEntry,
} from "./GuidanceReferralEntry";
import { AdmReviewDialog } from "../../adm/components/AdmReviewDialog";
import { GuidanceAdmReferralFormSheet } from "../../adm/components/GuidanceAdmReferralFormSheet";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { GuidanceActionMenu } from "./GuidanceActionMenu";
import {
  GUIDANCE_TYPES,
  type GuidanceAction,
  type GuidanceTypeFilter,
} from "./guidance-referrals-format";

import styles from "./guidance-referrals-table.module.css";

/* Re-exported for the interventions page (same helpers, new home). */
export {
  combineDateTime,
  formatDateTime,
  formatTime,
  sessionTypeLabel,
  toDateInputValue,
  toTimeInputValue,
  SESSION_KIND_OPTIONS,
} from "./guidance-referrals-format";

/* Spinner shown inside a button while its action is running. The button
   text already flips ("Saving…"), so this is purely visual. */
function Busy({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return <Loader2 className={styles.spin} aria-hidden="true" />;
}

/* Scroll hint — a floating "scroll for more" pill shown only while the
   page itself is scrollable and the reader hasn't reached the bottom.
   Rendered instead of the pager on full-list feeds. */
function ScrollHint({ count }: { count: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
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

import { useActiveNowTick } from "@/lib/clock";

export function GuidanceReferralsTable({
  referrals,
  summary,
  page = 1,
  pageSize = 0,
  total,
  totalPages = 1,
  onPageChange,
  query,
  onQueryChange,
  typeFilter,
  onTypeChange,
  action,
  onActionChange,
  onRetry,
  isRetrying,
  isNavigating = false,
  // Legacy full-list mode: every row renders, the pager is replaced by
  // the scroll hint. All guidance queues are server-paged now.
  paginate = true,
  lockType = false,
  title = "Referrals to me",
  highlightId = null,
  unfilteredTotal,
}: GuidanceReferralsTableProps) {
  const {
    dialogs,
    form,
    setForm,
    activeRow,
    activeSession,
    openDialog,
    openSessionDialog,
    closeDialog,
    mutation,
    handleAction,
    resolveCase,
    isActionPending,
    busyRowId,
    invalidateGuidance,
  } = useGuidanceReferralActions(referrals);
  /* Anecdotal record open in the official-form overlay (same as folder UI). */
  const [previewId, setPreviewId] = useState<string | null>(null);
  /* Student whose finished case shows the privacy notice instead. */
  const [privacyFor, setPrivacyFor] = useState<string | null>(null);
  /* Student whose endorsed case shows the moved-with-case notice instead. */
  const [endorsedFor, setEndorsedFor] = useState<string | null>(null);
  // ADM-track row under review (desk mode — same actions as the nurse ADM
  // review, without the coordinator form).
  const [reviewAdmFor, setReviewAdmFor] = useState<GuidanceReferralItem | null>(null);
  const [formSheet, setFormSheet] = useState<{
    row: GuidanceReferralItem;
    draft: AdmReviewDraft;
  } | null>(null);

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const goToPage = (next: number) => onPageChange?.(next);
  const hasActiveFilters =
    query.trim() !== "" || action !== "" || (!lockType && typeFilter !== "");
  // One live clock for every countdown on this page — ticks each second
  // only while a scheduled session is visible, so seconds stay exact.
  const hasScheduledOnPage = referrals.some((r) =>
    r.sessions.some((s) => s.status === "scheduled")
  );
  const now = useActiveNowTick(hasScheduledOnPage);
  const typeFilterLabel =
    GUIDANCE_TYPES.find((t) => t.value === typeFilter)?.label ?? "All types";

  function clearFilters() {
    onQueryChange("");
    onActionChange("");
    // Locked pages (ADM Cases / Counseling Cases) stay on their track —
    // clearing only resets the search and the action menu.
    onTypeChange(lockType ? typeFilter : "");
  }

  // Scroll the highlighted case into view once its page renders. The
  // backend serves the highlight's own page (?highlight=), so the row is
  // mounted on arrival; later page turns simply no-op when it is absent.
  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`guidance-case-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, referrals]);

  return (
    <div className={styles.layout}>
      <div className={`${styles.feed} ${styles.layoutFeed}`}>
        <h1 className={styles.srOnly}>Cases sent to guidance</h1>
        {/* Locked track pages hide the toolbar (title, search, track
            picker) — filtering lives in the action sidebar. Every queue
            is server-paginated, locked or not. */}
        {!lockType && (
        <div className={`${styles.toolbar} ${styles.toolbarSticky}`}>
          <div>
            <p className={styles.pageTitle}>{title}</p>
          </div>
          <div className={styles.toolbarFilters}>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} aria-hidden />
              <Input
                className={styles.searchInput}
                style={{ height: "1.75rem" }}
                placeholder="Search by student name or keyword…"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
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
                {GUIDANCE_TYPES.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.label}
                    checked={typeFilter === item.value}
                    onCheckedChange={() => {
                      onTypeChange(item.value);
                      // Sidebar actions are per-track — a stale action from
                      // the other track would empty the list, so reset it.
                      onActionChange("");
                      goToPage(1);
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
                onClick={clearFilters}
              >
                <X aria-hidden />
                Show all
              </Button>
            )}
          </div>
        </div>
        )}

      {mutation.isError && (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            Sorry — that change did not go through. Please try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRetrying}
            onClick={() => onRetry()}
          >
            <Busy busy={isRetrying} />
            {isRetrying ? "Loading…" : "Try again"}
          </Button>
        </div>
      )}
      {referrals.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {hasActiveFilters
              ? lockType
                ? "No cases match the selected filter"
                : "No cases match your search"
              : "You're all caught up"}
          </p>
          <p className={styles.emptyHint}>
            {hasActiveFilters
              ? lockType
                ? "Pick a different action in the sidebar, or show every case."
                : "Try a different name or keyword, or clear the filter to see every case."
              : "New cases sent to you by advisers will appear here."}
          </p>
        </div>
      ) : (
        <ol className={styles.timeline}>
          {referrals.map((row) => (
            <GuidanceReferralEntry
              key={row.id}
              row={row}
              now={now}
              highlighted={highlightId !== null && highlightId === row.id}
              actionPending={busyRowId !== null && busyRowId === row.id}
              onOpenDialog={(referralId, dialog) => openDialog(referralId, dialog)}
              onOpenSession={(referralId, session, dialog) =>
                openSessionDialog(referralId, session, dialog)
              }
              onPreview={setPreviewId}
              onPrivacy={setPrivacyFor}
              onEndorsedNotice={setEndorsedFor}
              onReviewAdm={setReviewAdmFor}
              onChanged={() => {
                invalidateGuidance();
              }}
            />
          ))}
        </ol>
      )}

      {/* Pager (server-paged mode) or scroll hint (full-list mode). */}
      {paginate ? (
        <nav className={styles.pager} aria-label="Cases pages">
          <p className={styles.range}>
            Showing cases {start}–{end} of {total}
            {unfilteredTotal !== undefined && unfilteredTotal !== total
              ? ` (of ${unfilteredTotal} on your desk)`
              : ""}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || isNavigating}
              onClick={() => goToPage(page - 1)}
              aria-label="Show newer cases"
            >
              ← Newer
            </Button>
            <span className={styles.pageLabel} aria-live="polite">
              {isNavigating ? (
                <span className={styles.loadingLabel}>
                  <Busy busy />
                  Loading…
                </span>
              ) : (
                `Page ${page} of ${totalPages}`
              )}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || isNavigating}
              onClick={() => goToPage(page + 1)}
              aria-label="Show older cases"
            >
              Older →
            </Button>
          </div>
        </nav>
      ) : (
        <ScrollHint count={total} />
      )}
      </div>

      <GuidanceActionMenu
        action={action}
        summary={summary}
        typeFilter={typeFilter}
        showCancelled={lockType}
        onPick={(value) => {
          onActionChange(action === value ? "" : value);
          goToPage(1);
        }}
        onClear={() => onActionChange("")}
      />

      <GuidanceReferralDialogs
        dialogs={dialogs}
        form={form}
        setForm={setForm}
        activeRow={activeRow}
        activeSession={activeSession}
        isActionPending={isActionPending}
        mutationIsPending={mutation.isPending}
        closeDialog={closeDialog}
        handleAction={handleAction}
        onResolveCase={resolveCase}
      />

      {/* Official GCForm-01 report overlay — same preview the folder UI opens. */}
      <OcForm01PreviewDialog
        recordId={previewId}
        onClose={() => setPreviewId(null)}
      />

      {/* Privacy notice instead of the report on finished cases. */}
      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={() => setPrivacyFor(null)}
        studentName={privacyFor ?? undefined}
      />
      {/* Moved-with-case notice instead of the report on endorsed cases. */}
      <PrivacyNoticeDialog
        open={endorsedFor !== null}
        onClose={() => setEndorsedFor(null)}
        studentName={endorsedFor ?? undefined}
        reason="endorsed"
      />
      {reviewAdmFor && (
        <AdmReviewDialog
          referralId={reviewAdmFor.id}
          student={reviewAdmFor.student}
          anecdotalId={reviewAdmFor.anecdotalId || null}
          info={{
            lrn: reviewAdmFor.lrn,
            section: reviewAdmFor.section,
            grade: reviewAdmFor.grade,
            category: reviewAdmFor.category,
            date: reviewAdmFor.date,
          }}
          open
          onClose={() => setReviewAdmFor(null)}
          onChanged={() => {
            invalidateGuidance();
          }}
          onCreateReferral={(draft) => setFormSheet({ row: reviewAdmFor, draft })}
          mode="desk"
        />
      )}
      {formSheet && (
        <GuidanceAdmReferralFormSheet
          open
          onClose={() => setFormSheet(null)}
          adapter={{
            id: formSheet.row.id,
            student: formSheet.row.student,
            lrn: formSheet.row.lrn,
            section: formSheet.row.section,
            grade: formSheet.row.grade,
            stage: "consultation",
            stageLabel: "Consultation and referral",
            eligibility: "pending",
            referralId: formSheet.row.id,
            referralStatus: formSheet.row.status,
            reason: formSheet.row.reason,
            referredBy: formSheet.row.referredBy,
            preparedBy: formSheet.row.referredBy,
            date: formSheet.row.date,
            meetingAttended: null,
            hasHomeVisit: false,
            approved: false,
            approvedAt: null,
            anecdotalId: formSheet.row.anecdotalId || undefined,
            category: formSheet.row.category,
            anecdotalExcerpt: formSheet.row.anecdotalExcerpt,
            recommendations: formSheet.row.recommendations,
          }}
          anecdotalId={formSheet.row.anecdotalId || null}
          lrn={formSheet.row.lrn}
          initialDraft={formSheet.draft}
          onChanged={() => {
            invalidateGuidance();
          }}
        />
      )}
    </div>
  );
}

interface GuidanceReferralsTableProps {
  referrals: GuidanceReferralItem[];
  summary: GuidanceReferralsSummary | null;
  page?: number;
  pageSize?: number;
  total: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  paginate?: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  typeFilter: GuidanceTypeFilter;
  onTypeChange: (value: GuidanceTypeFilter) => void;
  action: GuidanceAction;
  onActionChange: (value: GuidanceAction) => void;
  onRetry: () => void;
  isRetrying: boolean;
  isNavigating?: boolean;
  // Locked pages (ADM Cases / Counseling Cases) hide the track dropdown
  // and keep "Show all" within their own track.
  lockType?: boolean;
  title?: string;
  // Deep-link arrival from the alerts table: scrolls to and highlights
  // the case once its page renders.
  highlightId?: string | null;
  /** UNFILTERED desk total — shown beside the filtered pager count. */
  unfilteredTotal?: number;
}