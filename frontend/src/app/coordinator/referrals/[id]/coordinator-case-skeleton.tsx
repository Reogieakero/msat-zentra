"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "./case-page.module.css";
import skel from "./case-skeleton.module.css";

/** Board columns split exactly like the real case file (see `page.tsx`). */
const BOARD_ROWS: string[][] = [
  ["referral", "anecdotal", "meetings"],
  ["evidence", "certify"],
];

/** Mirrors the KanbanBoard outer shell (section > rounded bordered card). */
function BoardShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-2.5">
        {children}
      </div>
    </section>
  );
}

/** Mirrors KanbanBoardHeader — icon + title left, actions right, border-b. */
function BoardHeader({
  title,
  actions,
  icon = <Skeleton className={skel.icon} />,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="-mx-2.5 relative flex items-center gap-2 border-b border-border px-3.5 pb-2">
      <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
        {icon}
        <span className="min-w-0 flex-1">{title}</span>
      </span>
      <span className="flex shrink-0 items-center justify-end gap-2">
        {actions}
      </span>
    </div>
  );
}

function FolderPanelSkeleton() {
  return (
    <div className={styles.fileLayout}>
      <div className={styles.fileSide}>
        <Skeleton className={skel.folder} />
        <Skeleton className={skel.hint} />
      </div>
      <div className={styles.kpiGrid}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.kpi}>
            <Skeleton className={skel.kpiLabel} />
            <Skeleton className={skel.kpiValue} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MeetingsPanelSkeleton() {
  return (
    <div className={styles.panel}>
      <div className={styles.cardTitleRow}>
        <Skeleton className={skel.panelTitle} />
        <Skeleton className={skel.badgeSm} />
      </div>
      <ul className={`${styles.evidenceList} ${styles.meetingsList}`}>
        {[0, 1].map((i) => (
          <li key={i} className={skel.meetingRow}>
            <Skeleton className={skel.meetingTop} />
            <Skeleton className={skel.meetingLine} />
            <Skeleton className={skel.meetingLineShort} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidencePanelSkeleton() {
  return (
    <div className={styles.panel}>
      <Skeleton className={skel.panelTitle} />
      <div className={styles.evidenceCard}>
        <ul className={styles.evidenceRow}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={styles.evidenceItem}>
              <Skeleton className={skel.badgeSm} />
              <Skeleton className={skel.evidenceLabel} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CertifyPanelSkeleton() {
  return (
    <div className={styles.panel}>
      <Skeleton className={skel.panelTitle} />
      <Skeleton className={skel.text} />
      <Skeleton className={skel.textShort} />
      <Skeleton className={skel.panelBtn} />
    </div>
  );
}

function ColumnSkeleton({ id }: { id: string }) {
  const body =
    id === "referral" || id === "anecdotal" ? (
      <FolderPanelSkeleton />
    ) : id === "meetings" ? (
      <MeetingsPanelSkeleton />
    ) : id === "evidence" ? (
      <EvidencePanelSkeleton />
    ) : (
      <CertifyPanelSkeleton />
    );
  return (
    <div className={styles.column} role="listitem">
      <BoardShell>
        <BoardHeader
          icon={<Skeleton className={skel.columnIcon} />}
          title={<Skeleton className={skel.columnTitle} />}
        />
        <div className="px-1">
          <Skeleton className={skel.columnDesc} />
        </div>
        <div className={styles.columnInner}>{body}</div>
      </BoardShell>
    </div>
  );
}

export function CoordinatorCaseSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading case file">
      <div aria-hidden="true">
        <BoardShell>
          <BoardHeader
            icon={<Skeleton className={skel.mascot} />}
            title={
              <span className={styles.boardTitle}>
                <Skeleton className={skel.titleName} />
                <span className={styles.boardTitlePills}>
                  <Skeleton className={skel.titlePillMd} />
                  <Skeleton className={skel.titlePillSm} />
                </span>
              </span>
            }
            actions={
              <>
                <Skeleton className={skel.headerAction} />
                <Skeleton className={skel.headerActionWide} />
                <Skeleton className={skel.headerButton} />
              </>
            }
          />
          <div
            className={styles.boardRows}
            role="list"
            aria-label="Case workflow columns"
          >
            {BOARD_ROWS.map((row, ri) => (
              <div key={ri} className={styles.boardRow} role="presentation">
                {row.map((id) => (
                  <ColumnSkeleton key={id} id={id} />
                ))}
              </div>
            ))}
          </div>
        </BoardShell>

        <div style={{ height: "1rem" }} />

        <BoardShell>
          <BoardHeader
            title={<Skeleton className={skel.columnTitle} />}
            actions={<Skeleton className={skel.headerActionWide} />}
          />
          <div className="px-1">
            <Skeleton className={skel.columnDesc} />
          </div>
          <ul className={styles.checklist}>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={styles.checklistItem}>
                <Skeleton className={skel.checkDot} />
                <span className={styles.checkText}>
                  <Skeleton className={skel.checkLabel} />
                  <Skeleton className={skel.checkHint} />
                </span>
                <Skeleton className={skel.badgeSm} />
              </li>
            ))}
          </ul>
          <div className={styles.checklistNote}>
            <Skeleton className={skel.note} />
          </div>
        </BoardShell>
      </div>
    </div>
  );
}
