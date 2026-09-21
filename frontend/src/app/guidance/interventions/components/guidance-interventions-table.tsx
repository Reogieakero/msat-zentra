"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { combineDateTime } from "../../referrals/components/guidance-referrals-table";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
  CounselingSessionType,
  GuidanceInterventionsSummary,
  InterventionOutcome,
  ReviewDecision,
} from "./guidance-interventions-data";
import {
  cancelFollowUpSession,
  completeFollowUpSession,
  recordInterventionOutcome,
  rescheduleFollowUpSession,
  reviewIntervention,
  scheduleFollowUpSession,
  startFollowUp,
} from "./guidance-interventions-data";
import { InterventionTableRow } from "./intervention-row";
import {
  InterventionDialogs,
  type InterventionDialogKey,
} from "./intervention-dialogs";
import { Busy } from "./busy";
import { toast } from "@/components/ui/sonner";
import { GUIDANCE_QUERY_KEYS } from "../../overview/components/use-guidance-mutation";
import { apiErrorMessage } from "../../referrals/components/guidance-referrals-data";
import styles from "./guidance-interventions.module.css";

function interventionSuccessMessage(action: string): { title: string; description: string } {
  switch (action) {
    case "start":
      return {
        title: "Follow-up started",
        description: "The intervention is now assigned to you and tracked in the queue.",
      };
    case "review":
      return {
        title: "Review saved",
        description: "Your decision was recorded on this follow-up.",
      };
    case "outcome":
      return {
        title: "Outcome recorded",
        description: "The closing note was saved and the case status updated.",
      };
    case "schedule":
      return {
        title: "Session booked",
        description: "The counseling session was added to the plan with its date and time.",
      };
    case "finish":
      return {
        title: "Session completed",
        description: "Session notes were saved. A booked follow-up stays on the plan.",
      };
    case "move":
      return {
        title: "Session moved",
        description: "The session was rescheduled to the new date and time.",
      };
    case "cancelSess":
      return {
        title: "Session cancelled",
        description: "The session was cancelled and removed from the upcoming list.",
      };
    default:
      return { title: "Saved", description: "Your change was recorded." };
  }
}

/* Live clock — ticks every 30s; the elapsed readouts render days / hours /
   minutes only, so per-second ticks would just burn renders. Same as the
   alerts table. */
function useNowTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function GuidanceInterventionsTable({
  summary,
  students,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  query,
  onQueryChange,
  onRetry,
  isRetrying,
  isNavigating,
}: GuidanceInterventionsTableProps) {
  const queryClient = useQueryClient();
  const [dialogs, setDialogs] = useState<Record<InterventionDialogKey, boolean>>({
    start: false,
    change: false,
    outcome: false,
    schedule: false,
    finish: false,
    move: false,
    cancelSess: false,
  });
  const [collapsedPlans, setCollapsedPlans] = useState<Record<string, boolean>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeFollowUpId, setActiveFollowUpId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [actionText, setActionText] = useState("");
  const [priority, setPriority] = useState("normal");
  const [intakeNotes, setIntakeNotes] = useState("");
  const [sessDate, setSessDate] = useState("");
  const [sessTime, setSessTime] = useState("");
  const [sessType, setSessType] = useState("individual");
  const [sessVenue, setSessVenue] = useState("");
  const [outcomeStatus, setOutcomeStatus] =
    useState<InterventionOutcome>("ongoing");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  const activeRow = students.find((r) => r.studentKey === activeKey) ?? null;
  const activeFollowUp = activeRow?.intervention ?? null;
  const activeSession =
    activeFollowUp?.sessions.find((s) => s.id === activeSessionId) ?? null;

  const resetSessionForm = () => {
    setSessDate("");
    setSessTime("");
    setSessType("individual");
    setSessVenue("");
  };

  const closeDialog = (dialog: InterventionDialogKey) => {
    setDialogs((p) => ({ ...p, [dialog]: false }));
  };

  const openStart = (row: AtRiskStudentItem) => {
    setActiveKey(row.studentKey);
    setActiveFollowUpId(null);
    setActionText("");
    setPriority("normal");
    setIntakeNotes("");
    resetSessionForm();
    setDialogs((p) => ({ ...p, start: true }));
  };

  const openChange = (row: AtRiskStudentItem) => {
    if (!row.intervention) return;
    setActiveKey(row.studentKey);
    setActiveFollowUpId(row.intervention.id);
    setActionText(row.intervention.recommendedAction);
    setDialogs((p) => ({ ...p, change: true }));
  };

  const openOutcome = (row: AtRiskStudentItem) => {
    if (!row.intervention) return;
    setActiveKey(row.studentKey);
    setActiveFollowUpId(row.intervention.id);
    setOutcomeStatus(row.intervention.outcomeStatus);
    setOutcomeNotes(row.intervention.outcomeNotes);
    setDialogs((p) => ({ ...p, outcome: true }));
  };

  const openSchedule = (row: AtRiskStudentItem) => {
    if (!row.intervention) return;
    setActiveKey(row.studentKey);
    setActiveFollowUpId(row.intervention.id);
    resetSessionForm();
    setDialogs((p) => ({ ...p, schedule: true }));
  };

  const openSessionDialog = (
    row: AtRiskStudentItem,
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => {
    if (!row.intervention) return;
    setActiveKey(row.studentKey);
    setActiveFollowUpId(row.intervention.id);
    setActiveSessionId(session.id);
    setDialogs((p) => ({ ...p, [dialog]: true }));
  };

  const actionMutation = useMutation({
    mutationFn: async ({
      key,
      action,
      payload,
    }: {
      key: string;
      action: string;
      payload: unknown;
    }) => {
      switch (action) {
        case "start": {
          const p = payload as {
            recommendedAction: string;
            priority: "low" | "normal" | "high";
            intakeNotes?: string;
            firstSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return startFollowUp(key, p);
        }
        case "review": {
          const p = payload as {
            followUpId: string;
            decision: ReviewDecision;
            recommendedAction?: string;
          };
          return reviewIntervention(p.followUpId, {
            decision: p.decision,
            recommendedAction: p.recommendedAction,
          });
        }
        case "outcome": {
          const p = payload as {
            followUpId: string;
            outcomeStatus: InterventionOutcome;
            outcomeNotes?: string;
          };
          return recordInterventionOutcome(p.followUpId, {
            outcomeStatus: p.outcomeStatus,
            outcomeNotes: p.outcomeNotes,
          });
        }
        case "schedule": {
          const p = payload as {
            followUpId: string;
            scheduledAt: string;
            sessionType: CounselingSessionType;
            venue?: string;
          };
          return scheduleFollowUpSession(p.followUpId, {
            scheduledAt: p.scheduledAt,
            sessionType: p.sessionType,
            venue: p.venue,
          });
        }
        case "finish": {
          const p = payload as {
            followUpId: string;
            sessionId: string;
            sessionNotes: string;
            outcome?: string;
            followUpSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return completeFollowUpSession(p.followUpId, p.sessionId, {
            sessionNotes: p.sessionNotes,
            outcome: p.outcome,
            followUpSession: p.followUpSession,
          });
        }
        case "move": {
          const p = payload as {
            followUpId: string;
            sessionId: string;
            scheduledAt: string;
          };
          return rescheduleFollowUpSession(p.followUpId, p.sessionId, p.scheduledAt);
        }
        case "cancelSess": {
          const p = payload as {
            followUpId: string;
            sessionId: string;
            cancelReason?: string;
          };
          return cancelFollowUpSession(p.followUpId, p.sessionId, p.cancelReason);
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: (_data, variables) => {
      for (const key of GUIDANCE_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
      // Confirmed success only — toast fires after the server confirms.
      toast.success(interventionSuccessMessage(variables.action));
    },
    onError: (err) => {
      toast.error({
        title: "Could not save",
        description: apiErrorMessage(
          err,
          "The change did not go through. Check your connection and try again."
        ),
      });
    },
  });

  const busyVars = actionMutation.isPending ? actionMutation.variables : null;
  const isBusy = (key: string, action: string) =>
    !!busyVars && busyVars.key === key && busyVars.action === action;
  const rowLocked = (key: string) => !!busyVars && busyVars.key === key;
  const isActionPending = actionMutation.isPending;

  const runAction = (key: string, action: string, payload: unknown) => {
    // Idempotency: one user action issues one request even on rapid clicks.
    if (actionMutation.isPending) return;
    // Keep dialogs open while the request runs so the submit spinner stays
    // visible. Close only on confirmed success; on error the dialog stays
    // open with values intact so the user can retry or cancel.
    actionMutation.mutate(
      { key, action, payload },
      {
        onSuccess: () => {
          setDialogs({
            start: false,
            change: false,
            outcome: false,
            schedule: false,
            finish: false,
            move: false,
            cancelSess: false,
          });
          setActiveKey(null);
          setActiveFollowUpId(null);
          setActiveSessionId(null);
        },
      }
    );
  };

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasActiveSearch = query.trim() !== "";

  const followUpWhen = combineDateTime(sessDate, sessTime);
  const now = useNowTick();

  return (
    <section aria-label="Intervention cases" className={styles.feed}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.sectionTitle}>Intervention cases</h2>
          <p className={styles.sectionDesc} aria-live="polite">
            {total === 0
              ? "No at-risk students right now"
              : `${total} at-risk student${total === 1 ? "" : "s"}${
                  summary.waitingReview > 0
                    ? ` · ${summary.waitingReview} follow-up${summary.waitingReview === 1 ? "" : "s"} waiting for review`
                    : ""
                }`}
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              style={{ height: "2rem" }}
              placeholder="Search student…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Search at-risk students"
            />
          </div>
        </div>
      </div>

      {actionMutation.isError && (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            Sorry — that did not go through. Please try again.
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

      <div className={styles.tableBody}>
        {students.length === 0 ? (
          <p className={styles.empty}>
            {hasActiveSearch
              ? "No cases match your search."
              : "No intervention cases — nothing needs your attention right now."}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <Table aria-label="Intervention cases on the guidance desk">
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Risk level</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Latest action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>
                    <span className={styles.srOnly}>Row actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((row) => (
                  <InterventionTableRow
                    key={row.studentKey}
                    row={row}
                    locked={rowLocked(row.studentKey)}
                    isActionPending={isActionPending}
                    isBusy={(action) => isBusy(row.studentKey, action)}
                    planCollapsed={collapsedPlans[row.studentKey] === true}
                    onTogglePlan={() =>
                      setCollapsedPlans((p) => ({
                        ...p,
                        [row.studentKey]: !(p[row.studentKey] === true),
                      }))
                    }
                    expanded={expandedKey === row.studentKey}
                    onToggleDetails={() =>
                      setExpandedKey((prev) =>
                        prev === row.studentKey ? null : row.studentKey
                      )
                    }
                    now={now}
                    onStart={() => openStart(row)}
                    onChange={() => openChange(row)}
                    onOutcome={() => openOutcome(row)}
                    onSchedule={() => openSchedule(row)}
                    onSession={(session, dialog) =>
                      openSessionDialog(row, session, dialog)
                    }
                    onReview={(decision) =>
                      row.intervention &&
                      runAction(row.studentKey, "review", {
                        followUpId: row.intervention.id,
                        decision,
                      })
                    }
                    onDocsChanged={() => {
                      void queryClient.invalidateQueries({
                        queryKey: ["guidance-interventions"],
                      });
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className={styles.pager}>
          <p className={styles.range}>
            Showing {start}–{end} of {total}
          </p>
          <div className={styles.pagerButtons}>
            <Button
              size="xs"
              variant="outline"
              disabled={page <= 1 || isNavigating}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
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
              size="xs"
              variant="outline"
              disabled={page >= totalPages || isNavigating}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <InterventionDialogs
        open={dialogs}
        onClose={closeDialog}
        activeRow={activeRow}
        activeSession={activeSession}
        actionText={actionText}
        onActionText={setActionText}
        priority={priority}
        onPriority={setPriority}
        intakeNotes={intakeNotes}
        onIntakeNotes={setIntakeNotes}
        sessDate={sessDate}
        onSessDate={setSessDate}
        sessTime={sessTime}
        onSessTime={setSessTime}
        sessType={sessType}
        onSessType={setSessType}
        sessVenue={sessVenue}
        onSessVenue={setSessVenue}
        outcomeStatus={outcomeStatus}
        onOutcomeStatus={setOutcomeStatus}
        outcomeNotes={outcomeNotes}
        onOutcomeNotes={setOutcomeNotes}
        isActionPending={isActionPending}
        now={now}
        onSubmitStart={() => {
          if (!activeKey) return;
          runAction(activeKey, "start", {
            recommendedAction: actionText.trim(),
            priority: priority as "low" | "normal" | "high",
            ...(intakeNotes.trim() ? { intakeNotes: intakeNotes.trim() } : {}),
            ...(followUpWhen
              ? {
                  firstSession: {
                    scheduledAt: followUpWhen,
                    sessionType: sessType as CounselingSessionType,
                    ...(sessVenue.trim() ? { venue: sessVenue.trim() } : {}),
                  },
                }
              : {}),
          });
        }}
        onSubmitChange={() => {
          if (!activeKey || !activeFollowUpId) return;
          runAction(activeKey, "review", {
            followUpId: activeFollowUpId,
            decision: "modified",
            recommendedAction: actionText.trim(),
          });
        }}
        onSubmitOutcome={() => {
          if (!activeKey || !activeFollowUpId) return;
          runAction(activeKey, "outcome", {
            followUpId: activeFollowUpId,
            outcomeStatus,
            ...(outcomeNotes.trim()
              ? { outcomeNotes: outcomeNotes.trim() }
              : {}),
          });
        }}
        onSubmitSchedule={(fields) => {
          if (!activeKey || !activeFollowUpId) return;
          runAction(activeKey, "schedule", {
            followUpId: activeFollowUpId,
            scheduledAt: fields.scheduledAt,
            sessionType: fields.sessionType as CounselingSessionType,
            ...(fields.venue ? { venue: fields.venue } : {}),
          });
        }}
        onSubmitFinish={(fields) => {
          if (!activeKey || !activeFollowUpId || !activeSessionId) return;
          runAction(activeKey, "finish", {
            followUpId: activeFollowUpId,
            sessionId: activeSessionId,
            sessionNotes: fields.sessionNotes,
            ...(fields.outcome ? { outcome: fields.outcome } : {}),
            ...(fields.followUpSession
              ? {
                  followUpSession: {
                    scheduledAt: fields.followUpSession.scheduledAt,
                    sessionType: fields.followUpSession.sessionType as CounselingSessionType,
                    ...(fields.followUpSession.venue
                      ? { venue: fields.followUpSession.venue }
                      : {}),
                  },
                }
              : {}),
          });
        }}
        onSubmitMove={(scheduledAt) => {
          if (!activeKey || !activeFollowUpId || !activeSessionId) return;
          runAction(activeKey, "move", {
            followUpId: activeFollowUpId,
            sessionId: activeSessionId,
            scheduledAt,
          });
        }}
        onSubmitCancelSess={(reason) => {
          if (!activeKey || !activeFollowUpId || !activeSessionId) return;
          runAction(activeKey, "cancelSess", {
            followUpId: activeFollowUpId,
            sessionId: activeSessionId,
            ...(reason ? { cancelReason: reason } : {}),
          });
        }}
        canSubmitStart={
          !isActionPending && !!activeKey && actionText.trim() !== ""
        }
        canSubmitChange={
          !isActionPending &&
          !!activeKey &&
          !!activeFollowUpId &&
          actionText.trim() !== ""
        }
        canSubmitOutcome={
          !isActionPending &&
          !!activeKey &&
          !!activeFollowUpId &&
          !!activeFollowUp &&
          (outcomeStatus === "ongoing" ||
            (outcomeNotes.trim() !== "" &&
              (activeFollowUp.completedSessions > 0 ||
                // Discontinue path: no sessions finished, but the live risk
                // cleared to Low — the server re-verifies this before saving.
                (outcomeStatus === "unresolved" &&
                  activeRow?.riskLevel === "Low")))) &&
          !(
            activeFollowUp.approvalStatus === "pending" &&
            outcomeStatus !== "ongoing"
          )
        }
      />
    </section>
  );
}

interface GuidanceInterventionsTableProps {
  summary: GuidanceInterventionsSummary;
  students: AtRiskStudentItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  isRetrying: boolean;
  isNavigating: boolean;
}
