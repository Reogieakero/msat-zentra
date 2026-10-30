"use client";

import * as React from "react";
import { ArrowLeftRight, PenLine, SearchX, ShieldCheck } from "lucide-react";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PrincipalEmptyState } from "../../../../components/PrincipalEmptyCard";
import type { AdmReferralRow } from "@/services/principal/adm.types";
import {
  ADM_FOLDER_COLORS,
  AdmReferralKanbanCard,
} from "./adm-referral-kanban-card";
import styles from "../all.module.css";

export type AdmReferralLaneFilter = "all" | "awaiting" | "returned" | "signed";

const LANES: {
  key: Exclude<AdmReferralLaneFilter, "all">;
  title: string;
  hint: string;
  color: string;
  icon: React.ReactNode;
  match: (row: AdmReferralRow) => boolean;
}[] = [
  {
    key: "awaiting",
    title: "Awaiting signature",
    hint: "No cases are waiting for your signature on this page.",
    color: ADM_FOLDER_COLORS.awaiting,
    icon: <PenLine size={14} aria-hidden />,
    match: (row) => row.approvedBy === null && row.returnedAt === null,
  },
  {
    key: "returned",
    title: "Returned for revision",
    hint: "Cases you return to the ADM Coordinator will wait here until re-certified.",
    color: ADM_FOLDER_COLORS.returned,
    icon: <ArrowLeftRight size={14} aria-hidden />,
    match: (row) => row.returnedAt !== null,
  },
  {
    key: "signed",
    title: "Signed",
    hint: "Signed cases will be listed here as final.",
    color: ADM_FOLDER_COLORS.signed,
    icon: <ShieldCheck size={14} aria-hidden />,
    match: (row) => row.approvedBy !== null,
  },
];

export function AdmReferralsBoard({
  rows,
  loading,
  isFetching = false,
  error,
  search,
  laneFilter,
  actionId,
  onRequestSign,
  onRequestReturn,
  onViewForms,
  onRetry,
}: {
  rows: AdmReferralRow[];
  loading: boolean;
  isFetching?: boolean;
  error: string | null;
  search: string;
  laneFilter: AdmReferralLaneFilter;
  actionId: string | null;
  onRequestSign: (id: string) => void;
  onRequestReturn: (id: string) => void;
  onViewForms: (row: AdmReferralRow) => void;
  onRetry: () => void;
}) {
  const lanes = React.useMemo(
    () =>
      LANES.map((lane) => ({
        ...lane,
        rows: rows.filter((row) => lane.match(row)),
      })),
    [rows]
  );
  const visibleLanes =
    laneFilter === "all"
      ? lanes
      : lanes.filter((lane) => lane.key === laneFilter);

  if (loading) {
    return (
      <div className={styles.lanes} aria-busy="true" aria-label="Loading ADM cases">
        {LANES.map((lane) => (
          <KanbanBoard
            key={lane.key}
            title={lane.title}
            icon={<span style={{ color: lane.color }}>{lane.icon}</span>}
            className="bg-muted/60 dark:bg-muted/20"
          >
            <div className={styles.cardGrid} aria-hidden="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className={styles.skelCard}>
                  <Skeleton className={styles.skelCardHead} />
                  <Skeleton className={styles.skelCardBody} />
                  <Skeleton className={styles.skelCardFolder} />
                  <Skeleton className={styles.skelCardActions} />
                </div>
              ))}
            </div>
          </KanbanBoard>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-10" role="alert">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <PrincipalEmptyState
        icon={SearchX}
        title="No matches"
        hint={
          search.trim()
            ? `No endorsed cases match "${search}".`
            : "No cases match the selected filters."
        }
      />
    );
  }

  return (
    <div
      className={styles.lanes}
      aria-busy={isFetching || undefined}
      aria-label="Endorsed ADM cases board"
    >
      {visibleLanes.map((lane) => (
        <KanbanBoard
          key={lane.key}
          title={lane.title}
          icon={<span style={{ color: lane.color }}>{lane.icon}</span>}
          count={lane.rows.length}
          ariaLabel={`${lane.title} ADM cases`}
          boardLabel={`${lane.title} lane`}
          className="bg-muted/60 dark:bg-muted/20"
        >
          {lane.rows.length === 0 ? (
            <KanbanBoardEmpty>{lane.hint}</KanbanBoardEmpty>
          ) : (
            <ul className={styles.cardGrid}>
              {lane.rows.map((row) => (
                <li key={row.id} className="flex min-w-0">
                  <AdmReferralKanbanCard
                    row={row}
                    actionId={actionId}
                    onRequestSign={onRequestSign}
                    onRequestReturn={onRequestReturn}
                    onViewForms={onViewForms}
                  />
                </li>
              ))}
            </ul>
          )}
        </KanbanBoard>
      ))}
    </div>
  );
}
