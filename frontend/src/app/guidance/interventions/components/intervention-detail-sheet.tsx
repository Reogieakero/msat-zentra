"use client";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
} from "@/services/guidance/interventions.types";
import { CounselingPlan } from "./counseling-plan";
import {
  EngineBreakdown,
  levelVariant,
} from "./intervention-engine-breakdown";
import { Busy } from "./busy";
import { approvalLabel, outcomeLabel } from "./intervention-row-helpers";
import rowStyles from "./intervention-row.module.css";
import styles from "./guidance-interventions.module.css";
export function InterventionDetailSheet({
  row,
  followUp,
  expanded,
  onToggleDetails,
  displayLevel,
  status,
  detectedText,
  detectedTimeText,
  planCollapsed,
  onTogglePlan,
  locked,
  isActionPending,
  isBusy,
  workable,
  closed,
  isUnbooked,
  hasUpcoming,
  upcomingHint,
  onStart,
  onChange,
  onOutcome,
  onSchedule,
  onSession,
  onReview,
  onDocsChanged,
}: {
  row: AtRiskStudentItem;
  followUp: AtRiskStudentItem["intervention"];
  expanded: boolean;
  onToggleDetails: () => void;
  displayLevel: string;
  status: {
    label: string;
    variant: "default" | "success" | "secondary" | "destructive" | "outline" | "warning";
    sub: string | null;
  };
  detectedText: string;
  detectedTimeText: string | null;
  planCollapsed: boolean;
  onTogglePlan: () => void;
  locked: boolean;
  isActionPending: boolean;
  isBusy: (action: string) => boolean;
  workable: boolean;
  closed: boolean;
  isUnbooked: boolean;
  hasUpcoming: boolean;
  upcomingHint: string;
  onStart: () => void;
  onChange: () => void;
  onOutcome: () => void;
  onSchedule: () => void;
  onSession: (
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
  onReview: (decision: "approved" | "rejected") => void;
  onDocsChanged: () => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  return (
    <Sheet
      open={expanded}
      onOpenChange={(open) => {
        if (!open) onToggleDetails();
      }}
    >
      <SheetContent
        className="overflow-x-hidden p-4"
        style={{ maxWidth: "48rem" }}
      >
        <SheetHeader>
          <SheetTitle className={styles.srOnly}>{row.student}</SheetTitle>
        </SheetHeader>
        <div
          className={styles.sheetScroll}
          ref={scrollRef}
        >
          <div className={styles.sheetSections}>
            <section className={styles.sheetCard} aria-label="Case summary">
              <p className={styles.detailLabel}>Case summary</p>
              <p className={styles.summaryName}>{row.student}</p>
              <div className={styles.chipRow}>
                <div className={styles.chip}>
                  <span className={styles.chipLabel}>LRN</span>
                  <span className={styles.lrn}>{row.lrn || "—"}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipLabel}>Section</span>
                  <span>{row.section || "—"}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipLabel}>Grade</span>
                  <span>{row.grade || "—"}</span>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipLabel}>Risk level</span>
                  <Badge variant={levelVariant(displayLevel)}>
                    {displayLevel}
                  </Badge>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipLabel}>Status</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className={styles.chip}>
                  <span className={styles.chipLabel}>Detected</span>
                  <span>
                    {detectedText}
                    {detectedTimeText ? ` · ${detectedTimeText}` : ""}
                  </span>
                </div>
              </div>
            </section>
            <section className={styles.sheetCard} aria-label="Why at risk">
              <p className={styles.detailLabel}>Why at risk</p>
              <EngineBreakdown
                studentKey={row.studentKey}
                factors={row.factors}
                openReferrals={row.referralContext.open}
                closedReferrals={row.referralContext.closed}
                highPriority={followUp?.priority === "high"}
              />
            </section>
            <section className={styles.sheetSection} aria-label="Follow-up">
              {!followUp ? (
                <p className={rowStyles.cellMuted}>No follow-up yet</p>
              ) : (
                <div className={rowStyles.followUpCell}>
                  <div className={styles.noteBox}>
                    <p className={styles.noteLabel}>Note</p>
                    <p className={styles.noteText}>{followUp.recommendedAction}</p>
                  </div>
                  {(followUp.approvalStatus !== "approved" ||
                    followUp.outcomeStatus !== "ongoing") && (
                    <div className={rowStyles.badgeRow}>
                      {followUp.approvalStatus !== "approved" && (
                        <Badge
                          variant={
                            followUp.approvalStatus === "pending"
                              ? "warning"
                              : followUp.approvalStatus === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {approvalLabel(followUp.approvalStatus)}
                        </Badge>
                      )}
                      {followUp.outcomeStatus !== "ongoing" && (
                        <Badge
                          variant={
                            followUp.outcomeStatus === "resolved"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {outcomeLabel(followUp.outcomeStatus)}
                        </Badge>
                      )}
                    </div>
                  )}
                  {followUp.outcomeNotes ? (
                    <p className={rowStyles.cellSub}>{followUp.outcomeNotes}</p>
                  ) : null}
                  {followUp.intakeNotes ? (
                    <p className={rowStyles.cellSub}>
                      <span className={rowStyles.cellPrefix}>First impressions: </span>
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
                    onDocsChanged={onDocsChanged}
                  />
                </div>
              )}
            </section>
          </div>
        <div className="sticky bottom-2 z-10 flex justify-center pt-1">
          <ScrollDownHint
            scrollRef={scrollRef}
            watchKey={`${row.studentKey}-${planCollapsed}-${followUp?.sessions.length ?? 0}`}
            label="Scroll down"
            className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
          />
        </div>
        </div>
        <div className={styles.sheetFooter} aria-label="Actions">
          <div className={styles.sheetFooterActions}>
                {!followUp && (
                  <Button
                    type="button"
                    disabled={locked || isActionPending}
                    onClick={onStart}
                    title="Start the follow-up and book the first session"
                  >
                    <Busy busy={isBusy("start")} />
                    Book session
                  </Button>
                )}
                {isUnbooked && (
                  <Button
                    type="button"
                    disabled={locked || isActionPending}
                    onClick={onSchedule}
                  >
                    Book session
                  </Button>
                )}
                {followUp?.approvalStatus === "pending" && (
                  <>
                    <Button
                      type="button"
                      disabled={locked || isActionPending}
                      onClick={() => onReview("approved")}
                    >
                      <Busy busy={isBusy("review")} />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={locked || isActionPending}
                      onClick={onChange}
                    >
                      Change…
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={locked || isActionPending}
                      onClick={() => onReview("rejected")}
                    >
                      <Busy busy={isBusy("review")} />
                      Reject
                    </Button>
                  </>
                )}
                {followUp && !closed && status.label !== "No action yet" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={locked || isActionPending || hasUpcoming}
                    title={hasUpcoming ? upcomingHint : undefined}
                    onClick={onOutcome}
                  >
                    Record outcome…
                  </Button>
                )}
                {followUp && closed && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={locked || isActionPending}
                      onClick={onOutcome}
                      title="Update the closing notes on this finished follow-up"
                    >
                      Add note
                    </Button>
                    <Button
                      type="button"
                      disabled={locked || isActionPending}
                      onClick={onStart}
                      title="This student is still at risk — open a new follow-up"
                    >
                    <Busy busy={isBusy("start")} />
                    Start new follow-up
                  </Button>
                  </>
                )}
              </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
