"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  CounselingSessionItem,
  CounselingSessionType,
  GuidanceReferralItem,
  GuidanceReferralStatus,
  GuidanceReferralsSummary,
} from "./guidance-referrals-data";
import {
  acceptReferral,
  updateReferralStatus,
  escalateReferral,
  reassignReferral,
  addReferralNote,
  flagReferralFollowUp,
  dismissReferral,
  referToSpecialist,
  initiateAdm,
  scheduleSession,
  completeSession,
  rescheduleSession,
  cancelSession,
  deleteSession,
} from "./guidance-referrals-data";
import {
  GuidanceReferralDialogs,
  INITIAL_GUIDANCE_FORM,
  type GuidanceActionFormState as ActionFormState,
  type GuidanceActionDialogs as ActionDialogs,
} from "./GuidanceReferralDialogs";
import {
  GuidanceReferralEntry,
} from "./GuidanceReferralEntry";
import { AdmReviewDialog } from "../../adm/components/AdmReviewDialog";
import { GuidanceAdmReferralFormSheet } from "../../adm/components/GuidanceAdmReferralFormSheet";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { GuidanceActionMenu } from "./GuidanceActionMenu";
import {
  toDateInputValue,
  toTimeInputValue,
  GUIDANCE_TYPES,
  type GuidanceAction,
  type GuidanceTypeFilter,
} from "./guidance-referrals-format";
import { toast } from "@/components/ui/sonner";
import styles from "./guidance-referrals-table.module.css";

function referralActionMessage(action: string): { title: string; description: string } | null {
  switch (action) {
    case "escalate":
      return {
        title: "Sent to a higher office",
        description: "The case was escalated with your reason attached for the receiving office.",
      };
    case "reassign":
      return {
        title: "Case passed on",
        description: "The referral was reassigned and now appears on the new handler's desk.",
      };
    case "dismiss":
      return {
        title: "Case closed",
        description: "The referral was closed with your reason kept on record.",
      };
    case "specialist":
      return {
        title: "Specialist asked",
        description: "The referral was sent for specialist input with your reason attached.",
      };
    case "adm":
      return {
        title: "ADM process started",
        description: "The case is now on the ADM track and visible in the ADM queue.",
      };
    case "accept":
      return {
        title: "Case accepted",
        description: "The case is now in progress on your desk. A first session stays optional.",
      };
    case "schedule":
      return {
        title: "Session booked",
        description: "The counseling session was added with its date, time, and venue.",
      };
    case "finish":
      return {
        title: "Session completed",
        description: "Session notes were saved. Any booked follow-up stays on the plan.",
      };
    case "move":
      return {
        title: "Session moved",
        description: "The session was rescheduled to the new date and time.",
      };
    case "cancelSess":
      return {
        title: "Session cancelled",
        description: "The session was cancelled with your reason kept on record.",
      };
    case "deleteSess":
      return {
        title: "Session removed",
        description: "The cancelled session was permanently removed from the plan.",
      };
    case "resolve":
      return {
        title: "Case closed",
        description: "The closing summary was saved and the case left your active list.",
      };
    case "note":
      return {
        title: "Note saved",
        description: "Your internal note was attached to the case timeline.",
      };
    case "followUp":
      return {
        title: "Follow-up set",
        description: "A reminder was set — the case will resurface on the follow-up date.",
      };
    default:
      return { title: "Saved", description: "Your change was recorded on the case." };
  }
}

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

/* Live clock for the session countdowns — ticks each second while any
   scheduled session is on screen so the seconds stay exact. */
function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function GuidanceReferralsTable({
  referrals,
  summary,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  query,
  onQueryChange,
  typeFilter,
  onTypeChange,
  action,
  onActionChange,
  onRetry,
  isRetrying,
  isNavigating,
  lockType = false,
  title = "Referrals to me",
  highlightId = null,
}: GuidanceReferralsTableProps) {
  const queryClient = useQueryClient();
  const [dialogs, setDialogs] = useState<ActionDialogs>({
    escalate: false,
    reassign: false,
    note: false,
    followUp: false,
    dismiss: false,
    specialist: false,
    adm: false,
    accept: false,
    schedule: false,
    finish: false,
    move: false,
    cancelSess: false,
    deleteSess: false,
    resolve: false,
  });
  const [form, setForm] = useState<ActionFormState>(INITIAL_GUIDANCE_FORM);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
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

  const openDialog = (id: string, dialog: keyof ActionDialogs) => {
    setActiveId(id);
    setActiveSessionId(null);
    setForm(INITIAL_GUIDANCE_FORM);
    setDialogs((prev) => ({ ...prev, [dialog]: true }));
  };

  const openSessionDialog = (
    referralId: string,
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess" | "deleteSess"
  ) => {
    setActiveId(referralId);
    setActiveSessionId(session.id);
    setForm({
      ...INITIAL_GUIDANCE_FORM,
      // "Move" starts from the current slot; "finish" leaves the follow-up
      // date empty so booking the next session stays opt-in.
      sessDate: dialog === "move" ? toDateInputValue(session.scheduledAt) : "",
      sessTime: dialog === "move" ? toTimeInputValue(session.scheduledAt) : "",
      // Follow-up defaults to the same kind of session.
      sessType: dialog === "finish" ? session.sessionType : INITIAL_GUIDANCE_FORM.sessType,
    });
    setDialogs((prev) => ({ ...prev, [dialog]: true }));
  };

  const closeDialog = (dialog: keyof ActionDialogs) => {
    setDialogs((prev) => ({ ...prev, [dialog]: false }));
    if (Object.values(dialogs).every((v) => !v)) setActiveId(null);
  };

  const mutation = useMutation({
    mutationFn: ({
      id,
      next,
      summary,
    }: {
      id: string;
      next: GuidanceReferralStatus;
      summary?: string;
    }) => updateReferralStatus(id, next, summary),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-adm"] });
      toast.success({
        title: "Case closed",
        description: "The closing summary was saved and the case left your active list.",
      });
    },
    onError: () => {
      toast.error({
        title: "Could not close the case",
        description: "The change did not go through. Check your connection and try again.",
      });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      payload,
    }: {
      id: string;
      action: string;
      payload: unknown;
    }) => {
      switch (action) {
        case "escalate":
          return escalateReferral(
            id,
            (payload as { escalationReason: string; escalatedTo: string })
              .escalationReason,
            (payload as { escalatedTo: string }).escalatedTo as "principal" | "nurse" | "adm_coordinator"
          );
        case "reassign":
          return reassignReferral(
            id,
            (payload as { referredToRole: string }).referredToRole as "nurse" | "guidance_counselor" | "adm_coordinator" | "principal"
          );
        case "note":
          return addReferralNote(id, (payload as { notes: string }).notes);
        case "followUp":
          return flagReferralFollowUp(
            id,
            (payload as { followUpDate: string }).followUpDate
          );
        case "dismiss":
          return dismissReferral(
            id,
            (payload as { reason: string }).reason
          );
        case "specialist":
          return referToSpecialist(
            id,
            (payload as { referredToRole: string }).referredToRole as "nurse" | "adm_coordinator" | "principal",
            (payload as { reason: string }).reason
          );
        case "adm":
          return initiateAdm(id, (payload as { reason: string }).reason);
        case "accept": {
          const p = payload as {
            priority: "low" | "normal" | "high";
            intakeNotes?: string;
            firstSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return acceptReferral(id, p);
        }
        case "schedule": {
          const p = payload as {
            scheduledAt: string;
            sessionType: CounselingSessionType;
            venue?: string;
          };
          return scheduleSession(id, p);
        }
        case "finish": {
          const p = payload as {
            sessionId: string;
            sessionNotes: string;
            outcome?: string;
            followUpSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return completeSession(id, p.sessionId, {
            sessionNotes: p.sessionNotes,
            outcome: p.outcome,
            followUpSession: p.followUpSession,
          });
        }
        case "move": {
          const p = payload as { sessionId: string; scheduledAt: string };
          return rescheduleSession(id, p.sessionId, p.scheduledAt);
        }
        case "cancelSess": {
          const p = payload as { sessionId: string; cancelReason?: string };
          return cancelSession(id, p.sessionId, p.cancelReason);
        }
        case "deleteSess": {
          const p = payload as { sessionId: string };
          return deleteSession(id, p.sessionId);
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-adm"] });
      const message = referralActionMessage(variables.action);
      if (message) toast.success(message);
    },
    onError: () => {
      toast.error({
        title: "Could not save",
        description: "The action did not go through. Check your connection and try again.",
      });
    },
  });

  const handleAction = (action: string, payload: unknown) => {
    if (!activeId) return;
    if (actionMutation.isPending) return;
    // Keep the dialog open while the request runs so the submit button's
    // spinner stays visible. Close only on confirmed success; on error the
    // dialog stays open with its values intact so the user can retry.
    actionMutation.mutate(
      { id: activeId, action, payload },
      {
        onSuccess: () => {
          setDialogs({
            escalate: false,
            reassign: false,
            note: false,
            followUp: false,
            dismiss: false,
            specialist: false,
            adm: false,
            accept: false,
            schedule: false,
            finish: false,
            move: false,
            cancelSess: false,
            deleteSess: false,
            resolve: false,
          });
          setActiveId(null);
          setActiveSessionId(null);
        },
      }
    );
  };

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const isActionPending = actionMutation.isPending;

  const hasActiveFilters =
    query.trim() !== "" || action !== "" || (!lockType && typeFilter !== "");
  const activeRow = referrals.find((r) => r.id === activeId) ?? null;
  const activeSession =
    activeRow?.sessions.find((s) => s.id === activeSessionId) ?? null;
  // One live clock for every countdown on this page — ticks each second
  // only while a scheduled session is visible, so seconds stay exact.
  const hasScheduledOnPage = referrals.some((r) =>
    r.sessions.some((s) => s.status === "scheduled")
  );
  const now = useNowTick(hasScheduledOnPage);
  const typeFilterLabel =
    GUIDANCE_TYPES.find((t) => t.value === typeFilter)?.label ?? "All types";

  function clearFilters() {
    onQueryChange("");
    onActionChange("");
    // Locked pages (ADM Cases / Counseling Cases) stay on their track —
    // clearing only resets the search and the action menu.
    onTypeChange(lockType ? typeFilter : "");
  }

  // Scroll the highlighted case into view once its page renders.
  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      document
        .getElementById(`guidance-case-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [highlightId, page, referrals]);

  return (
    <div className={styles.layout}>
      <div className={`${styles.feed} ${styles.layoutFeed}`}>
        <h1 className={styles.srOnly}>Cases sent to guidance</h1>
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
            {/* Locked pages never need the track dropdown — the page itself
                is the track, so the picker would only ever hold one value. */}
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
                {GUIDANCE_TYPES.map((item) => (
                  <DropdownMenuCheckboxItem
                    key={item.label}
                    checked={typeFilter === item.value}
                    onCheckedChange={() => {
                      onTypeChange(item.value);
                      // Sidebar actions are per-track — a stale action from
                      // the other track would empty the list, so reset it.
                      onActionChange("");
                      onPageChange(1);
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
                onClick={clearFilters}
              >
                <X aria-hidden />
                Show all
              </Button>
            )}
          </div>
        </div>

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
      {actionMutation.isError && (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            Sorry — that action did not go through. Please try again.
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
              ? "No cases match your search"
              : "You're all caught up"}
          </p>
          <p className={styles.emptyHint}>
            {hasActiveFilters
              ? "Try a different name or keyword, or clear the filter to see every case."
              : "New cases sent to you by advisers will appear here."}
          </p>
        </div>
      ) : (
        <ol className={styles.timeline}>
          {referrals.map((row, index) => (
            <GuidanceReferralEntry
              key={row.id}
              row={row}
              alt={index % 2 === 1}
              now={now}
              highlighted={highlightId !== null && highlightId === row.id}
              actionPending={isActionPending}
              onOpenDialog={(referralId, dialog) => openDialog(referralId, dialog)}
              onOpenSession={(referralId, session, dialog) =>
                openSessionDialog(referralId, session, dialog)
              }
              onPreview={setPreviewId}
              onPrivacy={setPrivacyFor}
              onEndorsedNotice={setEndorsedFor}
              onReviewAdm={setReviewAdmFor}
              onChanged={() => {
                void queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
              }}
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
            disabled={page <= 1 || isNavigating}
            onClick={() => onPageChange(page - 1)}
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
            onClick={() => onPageChange(page + 1)}
            aria-label="Show older cases"
          >
            Older →
          </Button>
        </div>
      </nav>
      </div>

      <GuidanceActionMenu
        action={action}
        summary={summary}
        typeFilter={typeFilter}
        onPick={(value) => {
          onActionChange(action === value ? "" : value);
          onPageChange(1);
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
        onResolveCase={(id, summary) => {
          if (mutation.isPending) return;
          mutation.mutate(
            { id, next: "resolved", summary },
            {
              onSuccess: () => {
                setDialogs((prev) => ({ ...prev, resolve: false }));
                setActiveId(null);
              },
            }
          );
        }}
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
            void queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
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
            void queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
          }}
        />
      )}
    </div>
  );
}

interface GuidanceReferralsTableProps {
  referrals: GuidanceReferralItem[];
  summary: GuidanceReferralsSummary | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  typeFilter: GuidanceTypeFilter;
  onTypeChange: (value: GuidanceTypeFilter) => void;
  action: GuidanceAction;
  onActionChange: (value: GuidanceAction) => void;
  onRetry: () => void;
  isRetrying: boolean;
  isNavigating: boolean;
  // Locked pages (ADM Cases / Counseling Cases) hide the track dropdown
  // and keep "Show all" within their own track.
  lockType?: boolean;
  title?: string;
  // Deep-link arrival from the alerts table: scrolls to and highlights
  // the case once its page renders.
  highlightId?: string | null;
}