"use client";

import * as React from "react";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  FileSearch,
  Loader2,
  Megaphone,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InsightCallout } from "@/components/ui/insight-callout";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdviserAccessCheck } from "@/components/shared/adviser-access/adviser-access-check-context";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import {
  formatApproveDate,
  toBoardStudents,
  type AdviserAccessRequest,
  type BoardStudent,
} from "@/components/shared/adviser-access/adviser-access-types";
import styles from "../adviser-access.module.css";

const DESK = "record-keeper" as const;

const STATE: Record<
  BoardStudent["state"],
  { label: string; tone: PillTone; icon: React.ReactNode }
> = {
  pendingChecking: {
    label: "Unchecked",
    tone: "neutral",
    icon: <CircleDashed size={11} aria-hidden />,
  },
  awaiting: {
    label: "Awaiting decision",
    tone: "blue",
    icon: <Clock size={11} aria-hidden />,
  },
  approved: {
    label: "Approved",
    tone: "green",
    icon: <CheckCircle2 size={11} aria-hidden />,
  },
  reported: {
    label: "Reported",
    tone: "red",
    icon: <Megaphone size={11} aria-hidden />,
  },
};

const BTN = "h-6 shrink-0 px-2 text-[11px] font-medium";
const GREEN_BTN = `${BTN} border border-transparent bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600/30 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700`;
const RED_BTN = `${BTN} bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700`;

/** Table-shaped loading mirror for the adviser-access desk. */
export function AdviserAccessTableSkeleton({ rows = 6 }: { rows?: number }) {
  const headWidths = ["w-40", "w-24", "w-12", "w-20", "w-24", "w-20", "w-28", "w-16"];
  return (
    <KanbanBoard
      title="Adviser access requests"
      icon={<FileSearch size={14} className="text-primary" aria-hidden />}
      ariaLabel="Loading adviser access requests"
    >
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading adviser access requests"
        className="flex min-w-0 flex-col"
      >
        <div className="flex items-center gap-3 border-b border-border px-3 pb-2">
          {headWidths.map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w}`} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-b-0"
          >
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-40 max-w-full" />
              <Skeleton className="h-3 w-24 max-w-full" />
            </div>
            <Skeleton className="h-5 w-24 shrink-0 rounded-md" />
            <Skeleton className="h-5 w-12 shrink-0 rounded-md" />
            <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
            <Skeleton className="h-5 w-24 shrink-0 rounded-md" />
            <Skeleton className="h-5 w-20 shrink-0 rounded-md" />
            <Skeleton className="h-5 w-28 shrink-0 rounded-md" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </KanbanBoard>
  );
}

/**
 * Adviser-access desk as a single data table (same board+table shape as
 * `/coordinator/enrolled`), replacing the four-column card kanban.
 */
export function AdviserAccessTable({ requests }: { requests: AdviserAccessRequest[] }) {
  const {
    acting,
    approvingLrns,
    reportingLrns,
    bulkApproving,
    bulkReporting,
    checkAll,
    approveAllAwaiting,
    reportAllAwaiting,
    approveLrn,
    reportMissing,
    isRowBusy,
  } = useAdviserAccessCheck();

  const students = React.useMemo(() => toBoardStudents(requests), [requests]);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const filteredStudents = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.name} ${s.lrn} ${s.gradeLevel} ${s.section} ${s.adviserName}`
        .toLowerCase()
        .includes(q),
    );
  }, [students, query]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = React.useMemo(
    () => filteredStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredStudents, safePage],
  );
  const searching = query.trim().length > 0;

  const checking = React.useMemo(
    () => students.some((s) => s.state === "pendingChecking"),
    [students],
  );

  const pendingRequestIds = React.useMemo(
    () => [...new Set(students.filter((s) => s.state === "pendingChecking").map((s) => s.requestId))],
    [students],
  );
  const awaitingMatchedIds = React.useMemo(
    () => [...new Set(students.filter((s) => s.state === "awaiting" && s.hasRecord).map((s) => s.requestId))],
    [students],
  );
  const awaitingMissing = React.useMemo(
    () =>
      students
        .filter((s) => s.state === "awaiting" && !s.hasRecord)
        .map((s) => ({ requestId: s.requestId, lrn: s.lrn })),
    [students],
  );

  return (
    <KanbanBoard
      title="Adviser access requests"
      icon={<FileSearch size={14} className="text-primary" aria-hidden />}
      description="Every student in a pending Grades 7–10 adviser request · run the SF10 check, then approve or report each learner."
      ariaLabel="Adviser access requests"
      actions={
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              className={styles.search}
              placeholder="Search name, LRN, section, or adviser…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search adviser access requests"
            />
          </div>
          {pendingRequestIds.length > 0 ? (
            <Button
              type="button"
              size="sm"
              className={BTN}
              disabled={checking || acting}
              onClick={() => checkAll(DESK, pendingRequestIds)}
              title="Run the SF10 check for every unchecked request, one after another"
            >
              {checking ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <FileSearch size={12} aria-hidden />}
              {checking ? "Checking…" : "Check all"}
            </Button>
          ) : null}
          {awaitingMatchedIds.length > 0 ? (
            <Button
              type="button"
              size="sm"
              className={GREEN_BTN}
              disabled={acting || checking}
              onClick={() => approveAllAwaiting(DESK, awaitingMatchedIds)}
              title="Grant every student with a filed SF10 record"
            >
              {bulkApproving ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
              Approve all
            </Button>
          ) : null}
          {awaitingMissing.length > 0 ? (
            <Button
              type="button"
              size="sm"
              className={RED_BTN}
              disabled={acting || checking}
              onClick={() => reportAllAwaiting(DESK, awaitingMissing)}
              title="Report every student with no filed SF10 record"
            >
              {bulkReporting ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
              Report all
            </Button>
          ) : null}
        </div>
      }
    >
      {filteredStudents.length === 0 ? (
        <div className="flex w-full justify-center py-6">
          <InsightCallout role="status">
            {searching
              ? `No students match “${query.trim()}”.`
              : "No adviser access requests awaiting your decision."}
          </InsightCallout>
        </div>
      ) : (
        <Table aria-label="Adviser access requests">
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>LRN</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Adviser</TableHead>
              <TableHead>SF10 record</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((s) => {
              const state = STATE[s.state];
              const rowBusy = isRowBusy(s.lrn);
              const approving = approvingLrns.includes(s.lrn);
              const reporting = reportingLrns.includes(s.lrn);
              const approvedOn = s.state === "approved" ? formatApproveDate(s.approvedAt) : null;
              return (
                <TableRow key={`${s.requestId}:${s.lrn}`}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StudentMascot
                        name={s.name}
                        seed={s.lrn}
                        character={s.mascot ?? undefined}
                        size={32}
                      />
                      <span className="truncate text-[13px] font-semibold" title={s.name}>
                        {s.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Pill tone="amber" label="LRN">
                      {s.lrn}
                    </Pill>
                  </TableCell>
                  <TableCell>
                    <Pill tone="neutral" label="Grade level">
                      {s.gradeLevel}
                    </Pill>
                  </TableCell>
                  <TableCell>
                    <Pill tone="neutral" label="Section">
                      {s.section || "—"}
                    </Pill>
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-[10rem] truncate text-[12px]" title={s.adviserName}>
                      {s.adviserName}
                    </span>
                  </TableCell>
                  <TableCell>
                    {s.checkedAt ? (
                      <Pill
                        tone={s.hasRecord ? "green" : "red"}
                        label="SF10 record"
                      >
                        {s.hasRecord ? "Attached" : "Missing"}
                      </Pill>
                    ) : (
                      <Pill tone="neutral" label="SF10 record">
                        Not checked
                      </Pill>
                    )}
                  </TableCell>
                  <TableCell>
                    <Pill tone={state.tone} label="Decision status">
                      {state.icon}
                      {state.label}
                      {approvedOn ? ` · ${approvedOn}` : ""}
                    </Pill>
                  </TableCell>
                  <TableCell className="text-right">
                    {s.state === "pendingChecking" ? (
                      <Button
                        type="button"
                        size="sm"
                        className={BTN}
                        disabled={checking || acting}
                        onClick={() => checkAll(DESK, [s.requestId])}
                        title="Run the SF10 check for this request"
                      >
                        <FileSearch size={12} aria-hidden />
                        Check
                      </Button>
                    ) : s.state === "awaiting" ? (
                      s.hasRecord ? (
                        <Button
                          type="button"
                          size="sm"
                          className={GREEN_BTN}
                          disabled={rowBusy}
                          onClick={() => approveLrn(s.requestId, DESK, s.lrn)}
                          aria-label={`Approve access for ${s.name}`}
                        >
                          {approving ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                          {approving ? "Approving…" : "Approve"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className={RED_BTN}
                          disabled={rowBusy}
                          onClick={() => reportMissing(s.requestId, DESK, s.lrn)}
                          aria-label={`Report ${s.name} as missing`}
                        >
                          {reporting ? <Loader2 size={12} className="animate-spin" aria-hidden /> : null}
                          {reporting ? "Reporting…" : "Report"}
                        </Button>
                      )
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {s.state === "approved" ? "Granted" : "Reported"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {filteredStudents.length > 0 ? (
        <div className="border-t border-border px-3 py-2">
          <Pagination
            currentPage={safePage}
            totalItems={filteredStudents.length}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </KanbanBoard>
  );
}
