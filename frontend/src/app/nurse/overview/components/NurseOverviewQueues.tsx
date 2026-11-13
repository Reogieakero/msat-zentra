"use client";

import Link from "next/link";
import { Clock, Inbox, Stethoscope } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import { Pill, type PillTone } from "@/components/ui/pill";
import { NurseActionBadge, waitingElapsed } from "./nurse-action-badge";
import { useNowMs } from "./use-now-ms";
import type { NurseQueueRow } from "@/services/nurse/nurse.types";
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
 * LRN/grade/category pills, then the type + status pills and waiting pill.
 * Clicking a row opens that case on its desk board.
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
              const wait = waitingElapsed(item.referredAt, nowMs);
              return (
                <li key={item.id}>
                  <Link
                    href={seeMoreHref}
                    className={`${styles.caseRow} cursor-pointer no-underline transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
                    aria-label={`Open ${item.student}'s ${item.type === "ADM" ? "ADM" : "clinic"} case`}
                  >
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
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </KanbanBoard>
    </>
  );
}
