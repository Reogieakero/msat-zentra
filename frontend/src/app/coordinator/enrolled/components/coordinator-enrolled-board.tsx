"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { InsightCallout } from "@/components/ui/insight-callout";
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
  formatManilaDateLong,
} from "@/services/coordinator/labels";
import type { HistoryTarget } from "../../components/CaseHistoryDialog";
import { historyTargetFor } from "../../components/CaseHistoryDialog";
import { CoordinatorEmptyCard } from "../../components/CoordinatorEmptyCard";
import { toSlug } from "@/lib/slug";
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
  tone: PillTone;
}

const LANES: Record<LaneKey, Lane> = {
  not_released: { key: "not_released", title: "Not released", tone: "neutral" },
  in_progress: { key: "in_progress", title: "In progress", tone: "blue" },
  complete: { key: "complete", title: "Complete", tone: "green" },
};

const LANE_ICONS: Record<LaneKey, React.ReactNode> = {
  not_released: <CircleDashed size={12} aria-hidden="true" />,
  in_progress: <Clock size={12} aria-hidden="true" />,
  complete: <CheckCircle2 size={12} aria-hidden="true" />,
};

/** Status is derived from module counts — the monitoring signal.
    A case the coordinator already completed always reads "Complete". */
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

function EnrolledRow({
  row,
  index,
  onHistory,
  onComplete,
  completing,
}: {
  row: AdmCaseRow;
  /** Row position — drives the entrance stagger (same as schedule approval). */
  index: number;
  onHistory: (target: HistoryTarget) => void;
  onComplete: (row: AdmCaseRow) => void;
  completing: boolean;
}) {
  const { submitted, total, percent, text } = moduleProgress(row);
  const approvedBy = row.approvedBy ?? "the Principal";
  const isCompleted = row.stage === "completion";
  const lane = LANES[laneFor(row)];
  // The coordinator may only complete a case once every module is submitted.
  const modulesReady = total > 0 && submitted >= total;

  // Pre-profile referrals have no ADM case yet, so they can't open a detail page.
  const router = useRouter();
  const canOpen = !row.id.startsWith("referral:");
  const openCase = React.useCallback(() => {
    if (!canOpen) return;
    router.push(`/coordinator/enrolled/${toSlug(row.student)}`);
  }, [canOpen, router, row.student]);

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
    <TableRow
      className={`${styles.row} ${canOpen ? styles.rowClickable : ""}`}
      style={{ animationDelay: `${450 + Math.min(index, 11) * 140}ms` }}
      onClick={canOpen ? openCase : undefined}
      onKeyDown={
        canOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCase();
              }
            }
          : undefined
      }
      tabIndex={canOpen ? 0 : undefined}
      role={canOpen ? "link" : undefined}
      aria-label={canOpen ? `Open monitoring details for ${row.student}` : undefined}
    >
      <TableCell className={styles.learnerCell}>
        <span className={styles.mascot}>
          <StudentMascot
            name={row.student}
            seed={row.lrn}
            character={row.mascot ?? undefined}
            size={32}
          />
        </span>
        <span className={styles.learnerText}>
          <span className={styles.learnerName} title={row.student}>
            {row.student}
          </span>
          <span className={styles.learnerMeta}>
            Approved by {approvedBy}
            {row.approvalDate
              ? ` · ${formatManilaDateLong(row.approvalDate)}`
              : ""}
          </span>
        </span>
      </TableCell>

      <TableCell>
        <Pill tone="amber" label="LRN">
          {row.lrn}
        </Pill>
      </TableCell>

      <TableCell>
        <Pill tone="neutral" label="Grade level">
          {row.grade || "—"}
        </Pill>
      </TableCell>

      <TableCell>
        <Pill tone={lane.tone} label="Module status">
          {LANE_ICONS[lane.key]}
          {lane.title}
        </Pill>
      </TableCell>

      <TableCell className={styles.progressCell}>
        <span
          className={styles.progress}
          role="progressbar"
          aria-label={`Modules submitted for ${row.student}`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={submitted}
          aria-valuetext={text}
        >
          <span
            className={styles.progressFill}
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className={styles.progressNote}>{text}</span>
      </TableCell>

      <TableCell
        className={styles.actionsCell}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <TooltipProvider delayDuration={100}>
          <div className={styles.actions}>
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
      </TableCell>
    </TableRow>
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
  const searchTerm = query.trim().toLowerCase();

  // Filter the loaded page instantly as the clerk types (same feel as the
  // referrals desk); the debounced server query then swaps in matches from the
  // rest of the desk.
  const filteredRows = React.useMemo(() => {
    if (searchTerm === "") return rows;
    return rows.filter((row) =>
      `${row.student} ${row.lrn} ${row.grade} ${row.section ?? ""} ${row.id}`
        .toLowerCase()
        .includes(searchTerm),
    );
  }, [rows, searchTerm]);

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

  if (rows.length === 0 && !hasActiveFilters && searchTerm === "") {
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
      className={styles.boardIn}
      icon={
        <span className={styles.boardIcon} aria-hidden="true">
          <Columns3 size={14} />
        </span>
      }
      description="Every enrolled learner on one page · status grouped by module progress"
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
      {filteredRows.length === 0 ? (
        <div className={styles.emptyCallout}>
          <InsightCallout role="status">
            {searchTerm !== "" || hasActiveFilters
              ? "No enrolled learners match your search. Try a different name, LRN, or grade level."
              : "No learners in this view."}
          </InsightCallout>
        </div>
      ) : (
        <Table className={styles.table} aria-label="Enrolled ADM learners">
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>LRN</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Module progress</TableHead>
              <TableHead className={styles.actionsHead}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody key={filteredRows.map((r) => r.id).join("|")}>
            {filteredRows.map((row, index) => (
              <EnrolledRow
                key={row.id}
                row={row}
                index={index}
                completing={completingId === row.id}
                onHistory={onHistory}
                onComplete={onComplete}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </KanbanBoard>
  );
}

/** Table-shaped loading mirror for the page Suspense (single board shell). */
export function CoordinatorEnrolledBoardSkeleton() {
  return (
    <KanbanBoard
      title="Module monitoring"
      icon={
        <span className={styles.boardIcon} aria-hidden="true">
          <Columns3 size={14} />
        </span>
      }
      ariaLabel="Loading enrolled students"
    >
      <div className={styles.skelTable} aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skelRow} aria-hidden="true">
            <Skeleton className={styles.skelMascot} />
            <Skeleton className={styles.skelName} />
            <Skeleton className={styles.skelMeta} />
            <Skeleton className={styles.skelTrack} />
            <Skeleton className={styles.skelCta} />
          </div>
        ))}
      </div>
    </KanbanBoard>
  );
}
