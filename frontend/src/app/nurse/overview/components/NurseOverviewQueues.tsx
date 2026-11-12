"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, ClipboardCheck, Clock, Inbox, Send, Stethoscope } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import { Pill, type PillTone } from "@/components/ui/pill";
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
import { activeSessionOf } from "../../referrals/components/nurse-referrals-format";
import { useNurseInvalidate } from "./use-nurse-mutation";
import styles from "./nurse-overview.module.css";

/* Category colour coding shared with the referrals / anecdotal pages. */
const CATEGORY_TONE: Record<string, PillTone> = {
  behavioral: "amber",
  bullying: "red",
  academic: "blue",
  attendance: "green",
  health: "violet",
};

/**
 * Latest referrals board — the KanbanBoard shell (icon + title + count +
 * description) over one flat row per case: the latest five students referred
 * to the desk, newest referral first. Each row: roster mascot + name,
 * LRN/grade/category pills, then the type + status pills, waiting pill, and
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
                    <div className={styles.caseNameBlock}>
                      <p className={styles.cellMain}>{item.student}</p>
                      <div className={styles.caseMeta}>
                        <Pill label="LRN" className="tabular-nums">
                          {item.lrn}
                        </Pill>
                        {item.grade !== "—" && (
                          <Pill label="Grade level">{item.grade}</Pill>
                        )}
                        {item.category !== "—" && (
                          <Pill
                            tone={
                              CATEGORY_TONE[
                                item.category.trim().toLowerCase()
                              ] ?? "neutral"
                            }
                            label="Category"
                          >
                            {item.category}
                          </Pill>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.cellActions}>
                    {item.type === "ADM" ? (
                      <Pill tone="blue" label="Referral type">
                        ADM case
                      </Pill>
                    ) : (
                      <Pill label="Referral type">Clinic</Pill>
                    )}
                    <NurseActionBadge row={item} />
                    {wait !== "—" && (
                      <Pill
                        label={`Waiting since ${item.date}`}
                        className="gap-1 tabular-nums"
                      >
                        <Clock size={11} aria-hidden />
                        {wait}
                      </Pill>
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
