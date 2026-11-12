"use client";

import * as React from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Plus,
  Search,
  TabletSmartphone,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Pill } from "@/components/ui/pill";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { stageLabel } from "@/services/coordinator/labels";
import type { AdmDeviceRow } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-devices-table.module.css";

export type DeviceFilter = "all" | "issued" | "returned";

/* Status tabs in the board header — same centered pill-tab pattern as the
   certifications and referrals desks. */
const STATUS_TABS: { value: DeviceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "issued", label: "Issued" },
  { value: "returned", label: "Returned" },
];

/* Hover/click info board — a tiny kanban card that lists every device field as
   pills, grouped into learner / device / timeline sections. */
function DeviceInfoBoard({ row }: { row: AdmDeviceRow }) {
  const issued = row.status === "issued";
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoHead}>
        <StudentMascot
          name={row.student}
          seed={row.lrn}
          character={row.mascot ?? undefined}
          size={28}
        />
        <p className={styles.infoName} title={row.student}>
          {row.student}
        </p>
        <Pill
          tone={issued ? "amber" : "green"}
          label="Status"
          className="ml-auto"
        >
          {issued ? "Issued" : "Returned"}
        </Pill>
      </div>

      <div className={styles.infoBody}>
        <p className={styles.infoLabel}>Learner</p>
        <div className={styles.deviceChips}>
          <Pill tone="neutral" label="LRN" className="tabular-nums">
            LRN {row.lrn}
          </Pill>
          <Pill tone="neutral" label="Grade level">
            {row.grade}
          </Pill>
          <Pill
            tone={row.stage === "completion" ? "green" : "amber"}
            label="ADM stage"
            title={stageLabel(row.stage)}
          >
            {stageLabel(row.stage)}
          </Pill>
        </div>

        <p className={styles.infoLabel}>Device</p>
        <div className={styles.deviceChips}>
          <Pill tone="neutral" label="Device type">
            {row.deviceType}
          </Pill>
          <Pill tone="neutral" label="Serial number" className="tabular-nums">
            {row.deviceSerial}
          </Pill>
        </div>

        <p className={styles.infoLabel}>Timeline</p>
        <div className={styles.deviceChips}>
          <Pill tone="neutral" label="Issued" className="tabular-nums">
            <CalendarDays size={11} aria-hidden />
            Issued {row.issuedDate}
          </Pill>
          <Pill tone="neutral" label="Issued by">
            by {row.issuedBy}
          </Pill>
          {row.returnedDate ? (
            <Pill tone="neutral" label="Returned" className="tabular-nums">
              <Undo2 size={11} aria-hidden />
              Returned {row.returnedDate}
            </Pill>
          ) : null}
        </div>

        {row.conditionNotes ? (
          <>
            <p className={styles.infoLabel}>Condition</p>
            <p className={styles.infoNotePill}>{row.conditionNotes}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

interface CoordinatorDevicesBoardProps {
  rows: AdmDeviceRow[];
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  filter: DeviceFilter;
  onFilterChange: (v: DeviceFilter) => void;
  onClear: () => void;
  returningId?: string | null;
  onRetry: () => void;
  onRecordReturn: (row: AdmDeviceRow) => void;
  onIssueDevice: () => void;
}

function DeviceRow({
  row,
  index,
  returning,
  onRecordReturn,
}: {
  row: AdmDeviceRow;
  /** Row position — drives the entrance stagger, same as the enrolled table. */
  index: number;
  returning: boolean;
  onRecordReturn: (row: AdmDeviceRow) => void;
}) {
  const issued = row.status === "issued";
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [infoPinned, setInfoPinned] = React.useState(false);

  const handleInfoOpenChange = (next: boolean) => {
    if (!next && infoPinned) return;
    setInfoOpen(next);
  };

  const toggleInfo = () => {
    if (infoPinned) {
      setInfoPinned(false);
      setInfoOpen(false);
      return;
    }
    setInfoPinned(true);
    setInfoOpen(true);
  };

  return (
    <TableRow
      className={styles.row}
      style={{ animationDelay: `${450 + Math.min(index, 11) * 140}ms` }}
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
            Issued by {row.issuedBy}
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

      <TableCell className={styles.deviceCell}>
        <span className={styles.cellMain} title={row.deviceType}>
          {row.deviceType}
        </span>
        <span className={`${styles.cellSub} ${styles.mono}`}>
          {row.deviceSerial}
        </span>
      </TableCell>

      <TableCell className={styles.dateCell}>
        <span className={styles.mono}>{row.issuedDate}</span>
      </TableCell>

      <TableCell className={styles.dateCell}>
        {row.returnedDate ? (
          <span className={styles.mono}>{row.returnedDate}</span>
        ) : (
          <span className={styles.dash}>—</span>
        )}
      </TableCell>

      <TableCell>
        <Pill tone={issued ? "amber" : "green"} label="Status">
          {issued ? (
            <CircleDashed size={11} aria-hidden />
          ) : (
            <CheckCircle2 size={11} aria-hidden />
          )}
          {issued ? "Issued" : "Returned"}
        </Pill>
        {issued && row.stage === "completion" ? (
          <p className={styles.returnWarning}>
            <TriangleAlert size={11} aria-hidden="true" />
            Student completed — device not returned.
          </p>
        ) : null}
      </TableCell>

      <TableCell className={styles.actionsCell}>
        <div className={styles.actions}>
          <HoverCard
            open={infoOpen}
            onOpenChange={handleInfoOpenChange}
            openDelay={120}
            closeDelay={80}
          >
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={styles.ctaSecondary}
                onClick={toggleInfo}
                aria-label={`View details of ${row.deviceSerial}`}
              >
                Details
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              align="end"
              side="top"
              className="w-80 p-0"
              onPointerDownOutside={() => {
                setInfoPinned(false);
                setInfoOpen(false);
              }}
            >
              <DeviceInfoBoard row={row} />
            </HoverCardContent>
          </HoverCard>

          {issued ? (
            <button
              type="button"
              className={styles.cta}
              disabled={returning}
              onClick={() => onRecordReturn(row)}
              aria-busy={returning || undefined}
              aria-label={`Record return of ${row.deviceSerial}`}
            >
              {returning ? (
                <Loader2 className={styles.spin} aria-hidden="true" />
              ) : null}
              {returning ? "Recording…" : "Record return"}
            </button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Device ledger as a data table — one row per issued device, same board shell
 * + table chrome as the enrolled desk. Search, status filter and the issue
 * action share the board header; pagination sits under the board.
 */
export function CoordinatorDevicesBoard({
  rows,
  isPending,
  isError,
  isRefetching,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  onClear,
  returningId = null,
  onRetry,
  onRecordReturn,
  onIssueDevice,
}: CoordinatorDevicesBoardProps) {
  const searchTerm = query.trim().toLowerCase();

  // Filter the loaded page instantly as the clerk types (same feel as the
  // enrolled desk); the debounced server query then swaps in matches from the
  // rest of the ledger.
  const filteredRows = React.useMemo(() => {
    if (searchTerm === "") return rows;
    return rows.filter((row) =>
      `${row.student} ${row.lrn} ${row.deviceType} ${row.deviceSerial} ${row.grade}`
        .toLowerCase()
        .includes(searchTerm),
    );
  }, [rows, searchTerm]);

  if (isPending) {
    return <CoordinatorDevicesBoardSkeleton />;
  }

  if (isError) {
    return (
      <div className={styles.errorBlock} role="alert">
        <p className={styles.errorText}>
          We couldn&apos;t load the device ledger. Please check your internet
          connection and try again.
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

  return (
    <KanbanBoard
      title="Device ledger"
      ariaLabel="Learning devices"
      className={styles.boardIn}
      icon={
        <span className={styles.boardIcon} aria-hidden="true">
          <TabletSmartphone size={14} />
        </span>
      }
      description="Every device issued to a principal-approved ADM case — status, serial and return dates in one list."
      headerCenter={
        <div
          className={styles.filterRow}
          role="tablist"
          aria-label="Filter devices by status"
        >
          {STATUS_TABS.map((tab) => {
            const active = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                className={styles.filterButton}
                onClick={() => onFilterChange(tab.value)}
              >
                <Pill
                  tone={active ? "blue" : "neutral"}
                  label={`${tab.label} devices`}
                >
                  {tab.label}
                </Pill>
              </button>
            );
          })}
        </div>
      }
      actions={
        <>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search serial, student, or LRN…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Search serial, student, or LRN"
            />
          </div>

          {filter !== "all" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onClear}
            >
              Clear
            </Button>
          ) : null}

          <Button
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onIssueDevice}
          >
            <Plus className="size-3.5" aria-hidden />
            Issue device
          </Button>
        </>
      }
    >
      {filteredRows.length === 0 ? (
        <div className={styles.emptyCallout}>
          <InsightCallout role="status">
            {searchTerm !== ""
              ? "No devices match your search. Try a different serial, learner, or LRN."
              : "No devices match the current filters. Try a different status."}
          </InsightCallout>
        </div>
      ) : (
        <Table className={styles.table} aria-label="Device ledger">
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>LRN</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Returned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className={styles.actionsHead}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody key={filteredRows.map((r) => r.id).join("|")}>
            {filteredRows.map((row, index) => (
              <DeviceRow
                key={row.id}
                row={row}
                index={index}
                returning={returningId === row.id}
                onRecordReturn={onRecordReturn}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </KanbanBoard>
  );
}

/** Table-shaped loading mirror for the page Suspense (single board shell). */
export function CoordinatorDevicesBoardSkeleton() {
  return (
    <KanbanBoard
      title="Device ledger"
      ariaLabel="Loading devices"
      icon={
        <span className={styles.boardIcon} aria-hidden="true">
          <TabletSmartphone size={14} />
        </span>
      }
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
