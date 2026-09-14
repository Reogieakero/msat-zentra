"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { combineDateTime } from "../../referrals/components/guidance-referrals-table";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
  CounselingSessionType,
  FactorFilter,
  FollowUpStatusFilter,
  GuidanceInterventionsSummary,
  InterventionOutcome,
  ReviewDecision,
  RiskLevelFilter,
} from "./guidance-interventions-data";
import {
  assignIntervention,
  cancelFollowUpSession,
  completeFollowUpSession,
  fetchInterventionStaff,
  recordInterventionOutcome,
  rescheduleFollowUpSession,
  reviewIntervention,
  scheduleFollowUpSession,
  startFollowUp,
} from "./guidance-interventions-data";
import { InterventionFilters } from "./intervention-filters";
import { InterventionRow } from "./intervention-row";
import {
  InterventionDialogs,
  type InterventionDialogKey,
} from "./intervention-dialogs";
import { Busy } from "./busy";
import tableStyles from "../../pages.module.css";
import styles from "./guidance-interventions.module.css";

export function GuidanceInterventionsTable({
  summary,
  students,
  level,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  query,
  onQueryChange,
  onLevelChange,
  factor,
  onFactorChange,
  outcome,
  onOutcomeChange,
  mineOnly,
  onMineOnlyChange,
  myUserId,
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
  const [doneNotes, setDoneNotes] = useState("");
  const [doneOutcome, setDoneOutcome] = useState("");
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [outcomeStatus, setOutcomeStatus] =
    useState<InterventionOutcome>("ongoing");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  // Staff directory for the "assign to staff" handoff — fetched once, shared
  // by every row. Guidance intervenes directly or hands the case to someone
  // on this list.
  const { data: staffList } = useQuery({
    queryKey: ["guidance-intervention-staff"],
    queryFn: () => fetchInterventionStaff(),
    staleTime: 5 * 60 * 1000,
  });
  const staffOptions = (staffList ?? []).map((s) => ({
    value: s.id,
    label: `${s.fullName} · ${s.role.replace(/_/g, " ")}`,
  }));

  const activeRow = students.find((r) => r.studentKey === activeKey) ?? null;
  const activeFollowUp = activeRow?.intervention ?? null;
  const activeSession =
    activeFollowUp?.sessions.find((s) => s.id === activeSessionId) ?? null;

  const resetSessionForm = () => {
    setSessDate("");
    setSessTime("");
    setSessType("individual");
    setSessVenue("");
    setDoneNotes("");
    setDoneOutcome("");
    setCancelReasonInput("");
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
    setSessDate(dialog === "move" ? toDateInput(session.scheduledAt) : "");
    setSessTime(dialog === "move" ? toTimeInput(session.scheduledAt) : "");
    setSessType(dialog === "finish" ? session.sessionType : "individual");
    setSessVenue("");
    setDoneNotes("");
    setDoneOutcome("");
    setCancelReasonInput("");
    setDialogs((p) => ({ ...p, [dialog]: true }));
  };

  function toDateInput(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const month = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  }

  function toTimeInput(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
  }

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
        case "assign": {
          const p = payload as { followUpId: string; assigneeId: string | null };
          return assignIntervention(p.followUpId, p.assigneeId);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidance-interventions"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-alerts"] });
    },
  });

  const busyVars = actionMutation.isPending ? actionMutation.variables : null;
  const isBusy = (key: string, action: string) =>
    !!busyVars && busyVars.key === key && busyVars.action === action;
  const rowLocked = (key: string) => !!busyVars && busyVars.key === key;
  const isActionPending = actionMutation.isPending;

  const runAction = (key: string, action: string, payload: unknown) => {
    actionMutation.mutate({ key, action, payload });
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
  };

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasActiveFilters =
    query.trim() !== "" ||
    level !== "High" ||
    factor !== "" ||
    outcome !== "all" ||
    mineOnly;

  const followUpWhen = combineDateTime(sessDate, sessTime);

  return (
    <div className={styles.feed}>
      <div className={styles.toolbar}>
        <p className={styles.count} aria-live="polite">
          {total === 0
            ? "No at-risk students right now"
            : `${total} ${level === "All" ? "at-risk" : level === "High" ? "high-risk" : "moderate-risk"} student${total === 1 ? "" : "s"}${
                summary.waitingReview > 0
                  ? ` · ${summary.waitingReview} follow-up${summary.waitingReview === 1 ? "" : "s"} waiting for review`
                  : ""
              }`}
        </p>
        <InterventionFilters
          query={query}
          onQueryChange={onQueryChange}
          level={level}
          onLevelChange={onLevelChange}
          factor={factor}
          onFactorChange={onFactorChange}
          outcome={outcome}
          onOutcomeChange={onOutcomeChange}
          mineOnly={mineOnly}
          onMineOnlyChange={onMineOnlyChange}
        />
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

      {students.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {hasActiveFilters
              ? "Nobody matches those filters"
              : summary.resolved > 0
                ? "All caught up"
                : "No high-risk students right now"}
          </p>
          <p className={styles.emptyHint}>
            {hasActiveFilters
              ? "Try a different search, or show everyone."
              : summary.resolved > 0
                ? `${summary.resolved} finished follow-up${summary.resolved === 1 ? " is" : "s are"} hidden — change the follow-up filter to see ${summary.resolved === 1 ? "it" : "them"}.`
                : "The engine rechecks grades, attendance, and behavior filings every term. New high-risk students will appear here on their own."}
          </p>
        </div>
      ) : (
        <div className={tableStyles.tableWrap}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Why at risk</th>
                <th>Follow-up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((row) => (
                <InterventionRow
                  key={row.studentKey}
                  row={row}
                  myUserId={myUserId}
                  locked={rowLocked(row.studentKey)}
                  isActionPending={isActionPending}
                  isBusy={(action) => isBusy(row.studentKey, action)}
                  staffOptions={staffOptions}
                  planCollapsed={collapsedPlans[row.studentKey] === true}
                  onTogglePlan={() =>
                    setCollapsedPlans((p) => ({
                      ...p,
                      [row.studentKey]: !(p[row.studentKey] === true),
                    }))
                  }
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
                  onAssign={(assigneeId) =>
                    row.intervention &&
                    runAction(row.studentKey, "assign", {
                      followUpId: row.intervention.id,
                      assigneeId,
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className={styles.pager} aria-label="At-risk students pages">
        <p className={styles.range}>
          Showing {start}–{end} of {total}
        </p>
        <div className={styles.pagerButtons}>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || isNavigating}
            onClick={() => onPageChange(page - 1)}
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
          >
            Older →
          </Button>
        </div>
      </nav>

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
        doneNotes={doneNotes}
        onDoneNotes={setDoneNotes}
        doneOutcome={doneOutcome}
        onDoneOutcome={setDoneOutcome}
        cancelReasonInput={cancelReasonInput}
        onCancelReasonInput={setCancelReasonInput}
        outcomeStatus={outcomeStatus}
        onOutcomeStatus={setOutcomeStatus}
        outcomeNotes={outcomeNotes}
        onOutcomeNotes={setOutcomeNotes}
        isActionPending={isActionPending}
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
        onSubmitSchedule={() => {
          if (!activeKey || !activeFollowUpId || !followUpWhen) return;
          runAction(activeKey, "schedule", {
            followUpId: activeFollowUpId,
            scheduledAt: followUpWhen,
            sessionType: sessType as CounselingSessionType,
            ...(sessVenue.trim() ? { venue: sessVenue.trim() } : {}),
          });
        }}
        onSubmitFinish={() => {
          if (!activeKey || !activeFollowUpId || !activeSessionId) return;
          const nextAt = combineDateTime(sessDate, sessTime);
          runAction(activeKey, "finish", {
            followUpId: activeFollowUpId,
            sessionId: activeSessionId,
            sessionNotes: doneNotes.trim(),
            ...(doneOutcome.trim() ? { outcome: doneOutcome.trim() } : {}),
            ...(nextAt
              ? {
                  followUpSession: {
                    scheduledAt: nextAt,
                    sessionType: sessType as CounselingSessionType,
                    ...(sessVenue.trim() ? { venue: sessVenue.trim() } : {}),
                  },
                }
              : {}),
          });
        }}
        onSubmitMove={() => {
          const when = combineDateTime(sessDate, sessTime);
          if (!when || !activeKey || !activeFollowUpId || !activeSessionId)
            return;
          runAction(activeKey, "move", {
            followUpId: activeFollowUpId,
            sessionId: activeSessionId,
            scheduledAt: when,
          });
        }}
        onSubmitCancelSess={() => {
          if (!activeKey || !activeFollowUpId || !activeSessionId) return;
          runAction(activeKey, "cancelSess", {
            followUpId: activeFollowUpId,
            sessionId: activeSessionId,
            ...(cancelReasonInput.trim()
              ? { cancelReason: cancelReasonInput.trim() }
              : {}),
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
              activeFollowUp.completedSessions > 0)) &&
          !(
            activeFollowUp.approvalStatus === "pending" &&
            outcomeStatus !== "ongoing"
          )
        }
        canSubmitSchedule={
          !isActionPending &&
          !!activeKey &&
          !!activeFollowUpId &&
          followUpWhen !== null
        }
        canSubmitFinish={
          !isActionPending &&
          doneNotes.trim() !== "" &&
          !!activeKey &&
          !!activeFollowUpId &&
          !!activeSessionId
        }
        canSubmitMove={
          !isActionPending &&
          !!activeKey &&
          !!activeFollowUpId &&
          !!activeSessionId &&
          combineDateTime(sessDate, sessTime) !== null
        }
        canSubmitCancelSess={
          !isActionPending &&
          !!activeKey &&
          !!activeFollowUpId &&
          !!activeSessionId
        }
      />
    </div>
  );
}

interface GuidanceInterventionsTableProps {
  summary: GuidanceInterventionsSummary;
  students: AtRiskStudentItem[];
  level: RiskLevelFilter;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onLevelChange: (value: RiskLevelFilter) => void;
  factor: FactorFilter;
  onFactorChange: (value: FactorFilter) => void;
  outcome: FollowUpStatusFilter;
  onOutcomeChange: (value: FollowUpStatusFilter) => void;
  mineOnly: boolean;
  onMineOnlyChange: (value: boolean) => void;
  myUserId: string | null;
  onRetry: () => void;
  isRetrying: boolean;
  isNavigating: boolean;
}
