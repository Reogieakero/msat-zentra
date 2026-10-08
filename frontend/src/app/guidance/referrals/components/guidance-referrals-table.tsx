"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidanceReferralsToolbar } from "./guidance-referrals-toolbar";
import { GuidanceReferralsDialogsHost } from "./guidance-referrals-dialogs-host";
import { useGuidanceReferralsFilter } from "./use-guidance-referrals-filter";
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
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { GuidanceActionMenu } from "./GuidanceActionMenu";
import {
  GUIDANCE_TYPES,
  type GuidanceAction,
  type GuidanceTypeFilter,
} from "./guidance-referrals-format";

import styles from "./guidance-referrals-table.module.css";

export {
  combineDateTime,
  formatDateTime,
  formatTime,
  sessionTypeLabel,
  toDateInputValue,
  toTimeInputValue,
  SESSION_KIND_OPTIONS,
} from "./guidance-referrals-format";

function Busy({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return <Loader2 className={styles.spin} aria-hidden="true" />;
}

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

  const [previewId, setPreviewId] = useState<string | null>(null);

  const [privacyFor, setPrivacyFor] = useState<string | null>(null);

  const [endorsedFor, setEndorsedFor] = useState<string | null>(null);

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

  const { now } = useGuidanceReferralsFilter({ referrals, highlightId });
  const typeFilterLabel =
    GUIDANCE_TYPES.find((t) => t.value === typeFilter)?.label ?? "All types";

  function clearFilters() {
    onQueryChange("");
    onActionChange("");
    onTypeChange(lockType ? typeFilter : "");
  }

  return (
    <div className={styles.layout}>
      <div className={`${styles.feed} ${styles.layoutFeed}`}>
        <h1 className={styles.srOnly}>Cases sent to guidance</h1>
        {!lockType && (
          <GuidanceReferralsToolbar
            title={title}
            query={query}
            onQueryChange={onQueryChange}
            typeFilter={typeFilter}
            onTypeChange={onTypeChange}
            onActionChange={onActionChange}
            onPageChange={goToPage}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            typeFilterLabel={typeFilterLabel}
          />
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
      <GuidanceReferralsDialogsHost
        previewId={previewId}
        onPreviewClose={() => setPreviewId(null)}
        privacyFor={privacyFor}
        onPrivacyClose={() => setPrivacyFor(null)}
        endorsedFor={endorsedFor}
        onEndorsedClose={() => setEndorsedFor(null)}
        reviewAdmFor={reviewAdmFor}
        onReviewClose={() => setReviewAdmFor(null)}
        onReviewChanged={() => {
          invalidateGuidance();
        }}
        onCreateReferral={(draft) => {
          if (reviewAdmFor) setFormSheet({ row: reviewAdmFor, draft });
        }}
        formSheet={formSheet}
        onFormSheetClose={() => setFormSheet(null)}
        onFormSheetChanged={() => {
          invalidateGuidance();
        }}
      />
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

  lockType?: boolean;
  title?: string;

  highlightId?: string | null;

  unfilteredTotal?: number;
}
