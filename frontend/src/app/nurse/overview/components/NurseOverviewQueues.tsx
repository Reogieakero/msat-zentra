"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, ClipboardCheck, Clock, Inbox, Send, Stethoscope } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { NurseActionBadge, waitingElapsed } from "./nurse-action-badge";
import { useNowMs } from "./use-now-ms";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
import { NurseQueueRowActions } from "./NurseQueueRowActions";
import { NurseAdmReviewDialog } from "./NurseAdmReviewDialog";
import { NurseForwardAdmConfirm } from "./NurseForwardAdmConfirm";
import { NurseSessionScheduleBoard } from "./NurseSessionScheduleBoard";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import { NurseAdmReferralFormSheet } from "../../referrals/components/NurseAdmReferralFormSheet";
import { activeSessionOf, anecdotalCategoryPillClass } from "../../referrals/components/nurse-referrals-format";
import { useNurseInvalidate } from "./use-nurse-mutation";
import styles from "./nurse-overview.module.css";

/* Single shared pill metric for the case rows — rectangle pills (rounded-md)
   matching row-list.tsx, one step larger (12px) for LRN/category/waiting. */
const PILL_BASE =
  "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const PILL_SECONDARY = "border-border bg-secondary text-secondary-foreground";
const PILL_MUTED = "border-border bg-muted text-muted-foreground";

/**
 * Latest referrals board — the KanbanBoard shell (icon + title + count +
 * description) over one flat row per case: the latest five students referred
 * to the desk, newest referral first. Each row: roster mascot + name,
 * LRN/grade/category pills, then the type + status badges, waiting pill, and
 * a single kebab menu (all row buttons folded in). Filter behaves as before;
 * pagination auto-hides at five rows.
 */
export function NurseLatestReferralsPanel({
  latestReferrals,
  title = "Latest referred students",
  description = "The latest 5 students referred to the desk.",
  emptyText = "No referrals yet — new referrals will appear here.",
}: {
  latestReferrals: NurseQueueRow[];
  title?: string;
  description?: string;
  emptyText?: string;
}) {
  const [formSheet, setFormSheet] = React.useState<{
    row: NurseQueueRow;
    draft: AdmReviewDraft;
  } | null>(null);
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [forwardRow, setForwardRow] = React.useState<NurseQueueRow | null>(null);
  const reviewRow = React.useMemo(
    () => (reviewId ? latestReferrals.find((r) => r.id === reviewId) ?? null : null),
    [latestReferrals, reviewId],
  );
  const invalidateNurse = useNurseInvalidate();
  const refresh = React.useCallback(() => {
    invalidateNurse();
  }, [invalidateNurse]);
  const nowMs = useNowMs();

  return (
    <>
      <KanbanBoard
        title={title}
        icon={
          <span className="text-primary" aria-hidden>
            <Stethoscope size={14} />
          </span>
        }
        description={description}
        actions={
          /* Amber link on the title row — the desk's amber accent pair. */
          <Link
            href="/nurse/alerts"
            className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            View all
          </Link>
        }
      >
        {latestReferrals.length === 0 ? (
          <NurseEmptyState
            icon={Inbox}
            title="No referrals yet"
            hint={emptyText}
          />
        ) : (
          <ul className={styles.caseList}>
            {latestReferrals.map((item) => {
              const homeBase =
                item.type === "ADM"
                  ? "/nurse/referrals/adm"
                  : "/nurse/referrals/clinic";
              const seeMoreHref = `${homeBase}?highlight=${item.id}`;
              const viewFormHref =
                item.type === "ADM" ? `${seeMoreHref}&form=1` : seeMoreHref;
              const wait = waitingElapsed(item.referredAt, nowMs);
              const isReviewableAdm =
                item.type === "ADM" && item.status === "pending";
              const bookedSession = activeSessionOf(item.sessions);
              return (
                <li key={item.id} className={styles.caseRow}>
                  <div className={styles.caseInfo}>
                    <StudentMascot
                      name={item.student}
                      seed={item.lrn}
                      character={item.mascot ?? undefined}
                      size={32}
                    />
                    <p className={styles.cellMain}>{item.student}</p>
                    <span
                      className={`${PILL_BASE} ${PILL_SECONDARY} tabular-nums`}
                      title={item.lrn}
                    >
                      {item.lrn}
                    </span>
                    {item.grade !== "—" && (
                      <span className={`${PILL_BASE} ${PILL_MUTED}`}>
                        {item.grade}
                      </span>
                    )}
                    {item.category !== "—" && (
                      <span
                        className={`${PILL_BASE} ${
                          anecdotalCategoryPillClass(item.category) ??
                          PILL_SECONDARY
                        }`}
                      >
                        {item.category}
                      </span>
                    )}
                  </div>
                  <div className={styles.cellActions}>
                    {item.type === "ADM" ? (
                      <Badge variant="blue" className="rounded-md">
                        ADM case
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="rounded-md">
                        Clinic
                      </Badge>
                    )}
                    <NurseActionBadge row={item} className="rounded-md" />
                    {wait !== "—" && (
                      <span
                        className={`${PILL_BASE} ${PILL_MUTED} gap-1 tabular-nums`}
                        title={`Waiting since ${item.date}`}
                      >
                        <Clock size={11} aria-hidden />
                        {wait}
                      </span>
                    )}
                    <NurseQueueRowActions
                      row={item}
                      onChanged={refresh}
                      seeMoreHref={seeMoreHref}
                      viewFormHref={viewFormHref}
                      viewOnly
                      menuLeadingItems={
                        isReviewableAdm ? (
                          <>
                            {item.referralReady && (
                              <DropdownMenuItem
                                className={styles.menuItem}
                                onSelect={() => setForwardRow(item)}
                              >
                                <Send aria-hidden />
                                Endorse & forward…
                              </DropdownMenuItem>
                            )}
                            {bookedSession ? (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className={styles.menuItem}>
                                  <CalendarClock aria-hidden />
                                  Session schedule…
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent
                                  sideOffset={8}
                                  className="min-w-0 overflow-visible border-0 bg-transparent p-0 shadow-none ring-0"
                                >
                                  <NurseSessionScheduleBoard
                                    row={item}
                                    session={bookedSession}
                                  />
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            ) : (
                              <DropdownMenuItem
                                className={styles.menuItem}
                                onSelect={() => setReviewId(item.id)}
                              >
                                <ClipboardCheck aria-hidden />
                                Review ADM case…
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                          </>
                        ) : null
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </KanbanBoard>

      {reviewRow && (
        <NurseAdmReviewDialog
          row={reviewRow}
          open
          onClose={() => setReviewId(null)}
          onChanged={refresh}
          onCreateReferral={(draft) => setFormSheet({ row: reviewRow, draft })}
        />
      )}

      {forwardRow && (
        <NurseForwardAdmConfirm
          row={forwardRow}
          onClose={() => setForwardRow(null)}
        />
      )}

      {formSheet && (
        <NurseAdmReferralFormSheet
          open
          onClose={() => setFormSheet(null)}
          row={formSheet.row}
          initialDraft={formSheet.draft}
          onChanged={refresh}
        />
      )}
    </>
  );
}
