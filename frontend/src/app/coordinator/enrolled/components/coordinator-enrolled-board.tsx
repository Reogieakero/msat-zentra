"use client";

import * as React from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Columns3,
  CircleDashed,
  FileText,
  Loader2,
  NotebookPen,
  Search,
  SearchX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import {
  fetchOcForm01Detail,
} from "@/components/ocform01/ocform01";
import { GcForm03PreviewDialog } from "@/app/guidance/adm/components/GcForm03PreviewDialog";
import { buildGcForm03Data } from "@/services/guidance/gcform03.service";
import type { GcForm03Data } from "@/services/guidance/gcform03.types";
import type { AdmCaseRow } from "@/services/coordinator/coordinator.types";
import {
  eligibilityLabel,
  formatManilaDateLong,
} from "@/services/coordinator/labels";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { historyTargetFor } from "../../components/CaseHistoryDialog";
import { CoordinatorEmptyCard } from "../../components/CoordinatorEmptyCard";
import styles from "./coordinator-enrolled-board.module.css";

interface CoordinatorEnrolledBoardProps {
  rows: AdmCaseRow[];
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  hasActiveFilters: boolean;
  completingId: string | null;
  query: string;
  onQueryChange: (v: string) => void;
  onRetry: () => void;
  onHistory: (target: HistoryTarget) => void;
  onComplete: (row: AdmCaseRow) => void;
}

type LaneKey = "not_released" | "in_progress" | "complete";

interface Lane {
  key: LaneKey;
  title: string;
  hint: string;
  color: string;
  icon: React.ReactNode;
}

const LANES: Lane[] = [
  {
    key: "not_released",
    title: "Not released",
    hint: "No modules released yet.",
    color: "var(--muted-foreground)",
    icon: <CircleDashed size={14} aria-hidden="true" />,
  },
  {
    key: "in_progress",
    title: "In progress",
    hint: "Modules released, awaiting submissions.",
    color: "var(--primary)",
    icon: <Clock size={14} aria-hidden="true" />,
  },
  {
    key: "complete",
    title: "Complete",
    hint: "All released modules submitted, or the case is completed.",
    color: "#22c55e",
    icon: <CheckCircle2 size={14} aria-hidden="true" />,
  },
];

/** Lane assignment is derived from module counts — the monitoring signal.
    A case the coordinator already completed always sits in "Complete". */
function laneFor(row: AdmCaseRow): LaneKey {
  if (row.stage === "completion") return "complete";
  const hasData =
    typeof row.modulesSubmitted === "number" &&
    typeof row.modulesTotal === "number";
  if (!hasData) return "not_released";
  const total = row.modulesTotal ?? 0;
  const submitted = row.modulesSubmitted ?? 0;
  if (total === 0) return "not_released";
  return submitted >= total ? "complete" : "in_progress";
}

function moduleProgress(row: AdmCaseRow) {
  const hasData =
    typeof row.modulesSubmitted === "number" &&
    typeof row.modulesTotal === "number";
  const submitted = row.modulesSubmitted ?? 0;
  const total = row.modulesTotal ?? 0;
  const percent =
    hasData && total > 0 ? Math.min(100, Math.round((submitted / total) * 100)) : 0;
  const text = !hasData
    ? "Module progress syncing…"
    : total === 0
      ? "No modules released yet"
      : submitted >= total
        ? `All ${total} module${total === 1 ? "" : "s"} submitted`
        : `${submitted} of ${total} modules submitted`;
  return { submitted, total, percent, text };
}

function EnrolledItem({
  row,
  onHistory,
  onComplete,
  completing,
}: {
  row: AdmCaseRow;
  onHistory: (target: HistoryTarget) => void;
  onComplete: (row: AdmCaseRow) => void;
  completing: boolean;
}) {
  const { submitted, total, percent, text } = moduleProgress(row);
  const approvedBy = row.approvedBy ?? "the Principal";
  const isCompleted = row.stage === "completion";
  // The coordinator may only complete a case once every module is submitted.
  const modulesReady = total > 0 && submitted >= total;

  const anecdotalRecordId = row.anecdotalRecordId ?? null;
  const [anecdotalPreviewId, setAnecdotalPreviewId] = React.useState<
    string | null
  >(null);
  const [gcOpen, setGcOpen] = React.useState(false);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoading, setGcLoading] = React.useState(false);

  // GCForm-03 is generated from the linked OCForm-01 report, so both icon
  // shortcuts depend on the case's anecdotal record.
  const openGcForm = React.useCallback(async () => {
    if (!anecdotalRecordId || gcLoading) return;
    setGcLoading(true);
    try {
      const report = await fetchOcForm01Detail(anecdotalRecordId).catch(
        () => null,
      );
      setGcData(
        buildGcForm03Data(
          {
            student: row.student,
            grade: row.grade,
            section: row.section ?? "",
            reason: "",
            referredBy: row.preparedBy,
            date: row.datePrepared ?? "",
          },
          report,
          "",
        ),
      );
      setGcOpen(true);
    } finally {
      setGcLoading(false);
    }
  }, [
    anecdotalRecordId,
    gcLoading,
    row.student,
    row.grade,
    row.section,
    row.preparedBy,
    row.datePrepared,
  ]);

  return (
    <li className={styles.item}>
      <div className={styles.itemTop}>
        <span className={styles.mascot}>
          <StudentMascot name={row.student} seed={row.lrn} size={36} />
        </span>
        <p className={styles.itemTitle} title={row.student}>
          {row.student}
        </p>
        <Badge
          variant={
            isCompleted || row.eligibilityStatus === "eligible"
              ? "green"
              : row.eligibilityStatus === "ineligible"
                ? "destructive"
                : "outline"
          }
          className={styles.eligBadge}
        >
          {isCompleted ? "Completed" : eligibilityLabel(row.eligibilityStatus)}
        </Badge>
      </div>

      <div className={styles.chips}>
        <span className={`${styles.chip} ${styles.chipAmber}`} title={row.lrn}>
          {row.lrn}
        </span>
        <span className={`${styles.chip} ${styles.chipAmber}`}>{row.grade || "—"}</span>
      </div>

      <span
        className={styles.progress}
        role="progressbar"
        aria-label={`Modules submitted for ${row.student}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={submitted}
        aria-valuetext={text}
      >
        <span className={styles.progressFill} style={{ width: `${percent}%` }} />
      </span>
      <p className={styles.itemNote}>{text}</p>

      <div className={styles.approvalRow}>
        <span className={styles.itemNote}>Approved by {approvedBy}</span>
        {row.approvalDate ? (
          <span className={styles.chip}>{formatManilaDateLong(row.approvalDate)}</span>
        ) : null}
      </div>

      <TooltipProvider delayDuration={100}>
      <div className={styles.itemActions}>
        <div className={styles.actionsLeft}>
          <div className={styles.docActions}>
            {/* The trigger is a wrapper span so the tooltip still shows when
                the button itself is disabled (disabled controls emit no
                pointer events in most browsers). */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={styles.iconTrigger}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() =>
                      anecdotalRecordId &&
                      setAnecdotalPreviewId(anecdotalRecordId)
                    }
                    disabled={!anecdotalRecordId}
                    aria-label={`View anecdotal record for ${row.student}`}
                  >
                    <NotebookPen size={13} aria-hidden="true" />
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {anecdotalRecordId
                  ? "Anecdotal record (OCForm-01)"
                  : "No anecdotal record linked to this case"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={styles.iconTrigger}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => void openGcForm()}
                    disabled={!anecdotalRecordId || gcLoading}
                    aria-label={`View GC Form 03 for ${row.student}`}
                    aria-busy={gcLoading || undefined}
                  >
                    {gcLoading ? (
                      <Loader2
                        size={13}
                        className={styles.spin}
                        aria-hidden="true"
                      />
                    ) : (
                      <FileText size={13} aria-hidden="true" />
                    )}
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {anecdotalRecordId
                  ? "GC Form 03 (referral form)"
                  : "No anecdotal record linked to this case"}
              </TooltipContent>
            </Tooltip>
          </div>
          {!isCompleted && !modulesReady ? (
            <span className={styles.blockHint}>
              All modules must be submitted first
            </span>
          ) : null}
        </div>
        {!isCompleted ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={styles.ctaSecondary}
                onClick={() => onComplete(row)}
                disabled={completing || !modulesReady}
                aria-busy={completing || undefined}
                aria-label={`Mark ${row.student} as completed`}
              >
                {completing ? (
                  <Loader2 className={styles.spin} aria-hidden="true" />
                ) : null}
                {completing ? "Marking…" : "Mark completed"}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {modulesReady
                ? "Complete this ADM case"
                : "All released modules must be submitted first"}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={styles.cta}
              onClick={() => onHistory(historyTargetFor(row))}
              aria-label={`Track case for ${row.student}`}
            >
              Track case
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Open the case timeline</TooltipContent>
        </Tooltip>
      </div>
      </TooltipProvider>

      <OcForm01PreviewDialog
        recordId={anecdotalPreviewId}
        onClose={() => setAnecdotalPreviewId(null)}
      />
      <GcForm03PreviewDialog
        open={gcOpen}
        data={gcData}
        confirming={false}
        onClose={() => setGcOpen(false)}
        onConfirm={() => setGcOpen(false)}
        viewOnly
      />
    </li>
  );
}

function LaneBoard({
  lane,
  rows,
  completingId,
  onHistory,
  onComplete,
}: {
  lane: Lane;
  rows: AdmCaseRow[];
  completingId: string | null;
  onHistory: (target: HistoryTarget) => void;
  onComplete: (row: AdmCaseRow) => void;
}) {
  return (
    <KanbanBoard
      title={lane.title}
      icon={
        <span
          className={styles.laneIcon}
          style={{ color: lane.color }}
        >
          {lane.icon}
        </span>
      }
      count={rows.length}
      ariaLabel={`${lane.title} enrolled learners`}
      boardLabel={`${lane.title} lane`}
      className="bg-muted/60 dark:bg-muted/20"
    >
      {rows.length === 0 ? (
        <KanbanBoardEmpty>{lane.hint}</KanbanBoardEmpty>
      ) : (
        <ul className={styles.laneBody}>
          {rows.map((row) => (
            <EnrolledItem
              key={row.id}
              row={row}
              completing={completingId === row.id}
              onHistory={onHistory}
              onComplete={onComplete}
            />
          ))}
        </ul>
      )}
    </KanbanBoard>
  );
}

export function CoordinatorEnrolledBoard({
  rows,
  isPending,
  isError,
  isRefetching,
  hasActiveFilters,
  completingId,
  query,
  onQueryChange,
  onRetry,
  onHistory,
  onComplete,
}: CoordinatorEnrolledBoardProps) {
  const grouped = React.useMemo(() => {
    const map: Record<LaneKey, AdmCaseRow[]> = {
      not_released: [],
      in_progress: [],
      complete: [],
    };
    for (const row of rows) map[laneFor(row)].push(row);
    return map;
  }, [rows]);

  if (isPending) {
    return <CoordinatorEnrolledBoardSkeleton />;
  }

  if (isError) {
    return (
      <div className={styles.errorBlock} role="alert">
        <p className={styles.errorText}>
          We couldn&apos;t load the enrolled students. Please check your
          internet connection and try again.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={isRefetching}
          onClick={onRetry}
        >
          {isRefetching ? (
            <Loader2 className={styles.spin} aria-hidden="true" />
          ) : null}
          {isRefetching ? "Loading…" : "Try again"}
        </Button>
      </div>
    );
  }

  if (rows.length === 0 && !hasActiveFilters) {
    return (
      <CoordinatorEmptyCard
        icon={ClipboardList}
        title="No enrolled learners yet"
        hint="Approved cases appear here automatically once the Principal signs them."
        label="Enrolled ADM learners"
        centered
      />
    );
  }

  return (
    <KanbanBoard
      title="Module monitoring"
      icon={
        <span className={styles.boardIcon} aria-hidden="true">
          <Columns3 size={14} />
        </span>
      }
      count={rows.length}
      description="Grouped by module progress · one page at a time"
      ariaLabel="Enrolled ADM learners board"
      actions={
        <div className={styles.searchWrap}>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search name, LRN, or case ID…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Search enrolled students"
          />
        </div>
      }
    >
      {rows.length === 0 ? (
        <CoordinatorEmptyCard
          icon={SearchX}
          title="No matching learners"
          hint="No enrolled students match your search."
          label="Enrolled ADM learners"
        />
      ) : (
        <div className={styles.lanes}>
          {LANES.map((lane) => (
            <LaneBoard
              key={lane.key}
              lane={lane}
              rows={grouped[lane.key]}
              completingId={completingId}
              onHistory={onHistory}
              onComplete={onComplete}
            />
          ))}
        </div>
      )}
    </KanbanBoard>
  );
}

/** Lane-shaped loading mirrors (one board per column) for the page Suspense. */
export function CoordinatorEnrolledBoardSkeleton() {
  return (
    <div className={styles.lanes} aria-busy="true" aria-label="Loading enrolled students">
      {LANES.map((lane) => (
        <KanbanBoard
          key={lane.key}
          title={lane.title}
          icon={
            <span className={styles.laneIcon} style={{ color: lane.color }}>
              {lane.icon}
            </span>
          }
          className="bg-muted/60 dark:bg-muted/20"
        >
          <div aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.skelItem}>
                <Skeleton className={styles.skelTitle} />
                <Skeleton className={styles.skelMeta} />
                <Skeleton className={styles.skelTrack} />
                <Skeleton className={styles.skelNote} />
                <Skeleton className={styles.skelCta} />
              </div>
            ))}
          </div>
        </KanbanBoard>
      ))}
    </div>
  );
}
