"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
} from "./guidance-interventions-data";
import { CounselingPlan } from "./counseling-plan";
import { Busy } from "./busy";
import styles from "./intervention-row.module.css";

function approvalLabel(value: string): string {
  switch (value) {
    case "pending":
      return "Waiting for review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "modified":
      return "Changed";
    default:
      return value;
  }
}

function outcomeLabel(value: string): string {
  switch (value) {
    case "ongoing":
      return "Ongoing";
    case "resolved":
      return "Resolved";
    case "unresolved":
      return "Not resolved";
    default:
      return value;
  }
}

interface InterventionRowProps {
  row: AtRiskStudentItem;
  myUserId: string | null;
  locked: boolean;
  isActionPending: boolean;
  isBusy: (action: string) => boolean;
  planCollapsed: boolean;
  onTogglePlan: () => void;
  onStart: () => void;
  onChange: () => void;
  onOutcome: () => void;
  onSchedule: () => void;
  onSession: (
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
  onReview: (decision: "approved" | "rejected") => void;
  onAssign: (assigneeId: string | null) => void;
}

export function InterventionRow({
  row,
  myUserId,
  locked,
  isActionPending,
  isBusy,
  planCollapsed,
  onTogglePlan,
  onStart,
  onChange,
  onOutcome,
  onSchedule,
  onSession,
  onReview,
  onAssign,
}: InterventionRowProps) {
  const followUp = row.intervention;
  const isMine = !!myUserId && !!followUp && followUp.assigneeId === myUserId;
  const closed = !!followUp && followUp.outcomeStatus === "resolved";
  const workable =
    !!followUp &&
    followUp.outcomeStatus !== "resolved" &&
    followUp.approvalStatus !== "rejected";

  return (
    <tr>
      <td>
        <p className={styles.cellName}>{row.student}</p>
        <p className={styles.cellSub}>
          {row.lrn ? `${row.lrn} · ` : ""}
          {row.section}
          {row.grade ? ` · ${row.grade}` : ""}
        </p>
        {row.referralContext.open > 0 || row.referralContext.closed > 0 ? (
          <p className={styles.cellSub}>
            Also has adviser-referred cases:{" "}
            {[
              row.referralContext.open > 0
                ? `${row.referralContext.open} open`
                : "",
              row.referralContext.closed > 0
                ? `${row.referralContext.closed} resolved`
                : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </td>
      <td>
        <div className={styles.badgeRow}>
          <Badge variant={row.riskLevel === "High" ? "destructive" : "warning"}>
            {row.riskLevel} risk
          </Badge>
          {followUp?.priority === "high" ? (
            <Badge variant="destructive">High priority</Badge>
          ) : null}
          {followUp?.priority === "low" ? (
            <Badge variant="outline">Low priority</Badge>
          ) : null}
        </div>
        <ul className={styles.factorList}>
          {row.factors.academic && <li>Low grades</li>}
          {row.factors.attendance && <li>Absences</li>}
          {row.factors.behavioral && <li>Behavior report</li>}
        </ul>
      </td>
      <td>
        {!followUp ? (
          <p className={styles.cellMuted}>No follow-up yet</p>
        ) : (
          <div className={styles.followUpCell}>
            <p className={styles.cellText}>{followUp.recommendedAction}</p>
            <div className={styles.badgeRow}>
              <Badge
                variant={
                  followUp.approvalStatus === "pending"
                    ? "warning"
                    : followUp.approvalStatus === "approved"
                      ? "success"
                      : followUp.approvalStatus === "rejected"
                        ? "destructive"
                        : "secondary"
                }
              >
                {approvalLabel(followUp.approvalStatus)}
              </Badge>
              <Badge
                variant={
                  followUp.outcomeStatus === "ongoing"
                    ? "outline"
                    : followUp.outcomeStatus === "resolved"
                      ? "secondary"
                      : "destructive"
                }
              >
                {outcomeLabel(followUp.outcomeStatus)}
              </Badge>
            </div>
            <p className={styles.cellSub}>
              {followUp.assignee
                ? `Handled by ${followUp.assignee}`
                : "No one assigned yet"}
              {followUp.outcomeNotes ? ` — ${followUp.outcomeNotes}` : ""}
            </p>
            {followUp.intakeNotes ? (
              <p className={styles.cellSub}>
                <span className={styles.cellPrefix}>First impressions: </span>
                {followUp.intakeNotes}
              </p>
            ) : null}
            <CounselingPlan
              followUp={followUp}
              studentFirstName={row.student.split(" ")[0]}
              workable={workable}
              closed={closed}
              rejected={followUp.approvalStatus === "rejected"}
              collapsed={planCollapsed}
              onToggle={onTogglePlan}
              locked={locked}
              isActionPending={isActionPending}
              isBusy={isBusy}
              onSchedule={onSchedule}
              onSession={onSession}
            />
          </div>
        )}
      </td>
      <td>
        <div className={styles.actions}>
          {!followUp && (
            <Button
              type="button"
              size="xs"
              disabled={locked || isActionPending}
              onClick={onStart}
            >
              <Busy busy={isBusy("start")} />
              Start follow-up…
            </Button>
          )}
          {followUp?.approvalStatus === "pending" && (
            <>
              <Button
                type="button"
                size="xs"
                disabled={locked || isActionPending}
                onClick={() => onReview("approved")}
              >
                <Busy busy={isBusy("review")} />
                Approve
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={locked || isActionPending}
                onClick={onChange}
              >
                Change…
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={locked || isActionPending}
                onClick={() => onReview("rejected")}
              >
                <Busy busy={isBusy("review")} />
                Reject
              </Button>
            </>
          )}
          {followUp && !closed && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={locked || isActionPending}
              onClick={onOutcome}
            >
              Record outcome…
            </Button>
          )}
          {followUp && !isMine && !closed && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={locked || isActionPending || !myUserId}
              onClick={() => myUserId && onAssign(myUserId)}
            >
              <Busy busy={isBusy("assign")} />
              {followUp.assignee ? "Take over" : "Take this case"}
            </Button>
          )}
          {followUp && isMine && !closed && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={locked || isActionPending}
              onClick={() => onAssign(null)}
            >
              <Busy busy={isBusy("assign")} />
              Release
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
