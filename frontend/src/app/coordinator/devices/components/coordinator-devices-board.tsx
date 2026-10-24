"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronDown,
  Loader2,
  Plus,
  SearchIcon,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Pagination } from "@/components/shared/pagination";
import { stageLabel } from "@/services/coordinator/labels";
import type { AdmDeviceRow } from "@/services/coordinator/coordinator.types";
import styles from "./coordinator-devices-table.module.css";

export type DeviceFilter = "all" | "issued" | "returned";

/* Status menu options with their accent dots — amber for issued, green for
   returned, matching the badges on each card. */
const STATUS_OPTIONS: { value: DeviceFilter; label: string; color: string }[] = [
  { value: "all", label: "All statuses", color: "var(--muted-foreground)" },
  { value: "issued", label: "Issued", color: "#f59e0b" },
  { value: "returned", label: "Returned", color: "#22c55e" },
];

/* Rectangle pills — same metric as the nurse overview case rows. */
const PILL_BASE =
  "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const PILL_SECONDARY = "border-border bg-secondary text-secondary-foreground";
const PILL_MUTED = "border-border bg-muted text-muted-foreground";

interface CoordinatorDevicesBoardProps {
  rows: AdmDeviceRow[];
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  isBackground?: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  filter: DeviceFilter;
  onFilterChange: (v: DeviceFilter) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  returningId?: string | null;
  total: number;
  page: number;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onRecordReturn: (row: AdmDeviceRow) => void;
  onIssueDevice: () => void;
}

/* Hover/click info board — a tiny kanban card that lists every device field as
   pills, grouped into learner / device / timeline sections. */
function DeviceInfoBoard({ row }: { row: AdmDeviceRow }) {
  const issued = row.status === "issued";
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoHead}>
        <StudentMascot name={row.student} seed={row.lrn} size={28} />
        <p className={styles.infoName} title={row.student}>
          {row.student}
        </p>
        <Badge
          variant={issued ? "amber" : "green"}
          className="ml-auto shrink-0 rounded-md"
        >
          {issued ? "Issued" : "Returned"}
        </Badge>
      </div>

      <div className={styles.infoBody}>
        <p className={styles.infoLabel}>Learner</p>
        <div className={styles.deviceChips}>
          <span className={`${PILL_BASE} ${PILL_SECONDARY} tabular-nums`}>
            LRN {row.lrn}
          </span>
          <span className={`${PILL_BASE} ${PILL_MUTED}`}>{row.grade}</span>
          <span
            className={`${PILL_BASE} ${
              row.stage === "completion"
                ? styles.stagePillGreen
                : styles.stagePillAmber
            }`}
            title={stageLabel(row.stage)}
          >
            {stageLabel(row.stage)}
          </span>
        </div>

        <p className={styles.infoLabel}>Device</p>
        <div className={styles.deviceChips}>
          <span className={`${PILL_BASE} ${PILL_SECONDARY}`}>
            {row.deviceType}
          </span>
          <span className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}>
            {row.deviceSerial}
          </span>
        </div>

        <p className={styles.infoLabel}>Timeline</p>
        <div className={styles.deviceChips}>
          <span className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}>
            <CalendarDays size={11} aria-hidden />
            Issued {row.issuedDate}
          </span>
          <span className={`${PILL_BASE} ${PILL_MUTED}`}>
            by {row.issuedBy}
          </span>
          {row.returnedDate ? (
            <span className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}>
              <Undo2 size={11} aria-hidden />
              Returned {row.returnedDate}
            </span>
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

function DeviceCard({
  row,
  returning,
  onRecordReturn,
}: {
  row: AdmDeviceRow;
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
    <li className={styles.deviceCard}>
      <div className={styles.deviceCardHead}>
        <div className={styles.deviceTop}>
          <StudentMascot name={row.student} seed={row.lrn} size={32} />
          <div className={styles.deviceIdentity}>
            <p className={styles.cellMain} title={row.student}>
              {row.student}
            </p>
            <div className={styles.deviceChips}>
              <span
                className={`${PILL_BASE} ${PILL_SECONDARY} tabular-nums`}
                title={`LRN ${row.lrn}`}
              >
                {row.lrn}
              </span>
              {row.grade ? (
                <span
                  className={`${PILL_BASE} ${PILL_MUTED}`}
                  title={`Grade ${row.grade}`}
                >
                  {row.grade}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <Badge
          variant={issued ? "amber" : "green"}
          className="shrink-0 rounded-md"
        >
          {issued ? "Issued" : "Returned"}
        </Badge>
      </div>

      {/* Inner card — the device details sit on their own panel. */}
      <div className={styles.deviceCardBody}>
        <div className={styles.deviceChips}>
          <span className={`${PILL_BASE} ${PILL_SECONDARY}`} title="Device type">
            {row.deviceType}
          </span>
          <span
            className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}
            title={`Serial ${row.deviceSerial}`}
          >
            {row.deviceSerial}
          </span>
        </div>

        <div className={styles.deviceChips}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}
                tabIndex={0}
                aria-label={`Issued ${row.issuedDate} by ${row.issuedBy}`}
              >
                <CalendarDays size={11} aria-hidden />
                {row.issuedDate}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Issued on {row.issuedDate} · by {row.issuedBy}
            </TooltipContent>
          </Tooltip>
          {row.returnedDate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}
                  tabIndex={0}
                  aria-label={`Returned ${row.returnedDate}`}
                >
                  <Undo2 size={11} aria-hidden />
                  {row.returnedDate}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Returned on {row.returnedDate}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {issued && row.stage === "completion" ? (
          <p className={styles.returnWarning}>
            <TriangleAlert size={11} aria-hidden="true" />
            Student completed — device not returned yet.
          </p>
        ) : null}
      </div>

      <div className={styles.deviceActions}>
        <HoverCard
          open={infoOpen}
          onOpenChange={handleInfoOpenChange}
          openDelay={120}
          closeDelay={80}
        >
          <HoverCardTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={toggleInfo}
              aria-label={`View details of ${row.deviceSerial}`}
            >
              Details
            </Button>
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
          <Button
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={returning}
            onClick={() => onRecordReturn(row)}
            aria-label={`Record return of ${row.deviceSerial}`}
          >
            {returning ? (
              <>
                <Loader2 className={styles.spin} aria-hidden="true" />
                Recording…
              </>
            ) : (
              "Record return"
            )}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Device ledger as a kanban-style card grid — five per row on wide desks,
 * every card the same height. Each card: status badge, mascot + student with
 * LRN/grade, then device/date pills and the row actions.
 */
export function CoordinatorDevicesBoard({
  rows,
  isPending,
  isError,
  isRefetching,
  isBackground = false,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  hasActiveFilters,
  onClear,
  returningId = null,
  total,
  page,
  onRetry,
  onPageChange,
  onRecordReturn,
  onIssueDevice,
}: CoordinatorDevicesBoardProps) {
  const statusLabel =
    filter === "issued" ? "Issued" : filter === "returned" ? "Returned" : "Status";
  const activeOption = STATUS_OPTIONS.find((o) => o.value === filter);

  if (isPending) {
    return (
      <div className={styles.skeletonShell} aria-busy="true" aria-label="Loading devices">
        <div className={styles.skeletonHead}>
          <Skeleton className={styles.skelTitle} />
          <Skeleton className={styles.skelDesc} />
        </div>
        <Skeleton className={styles.skelSearch} />
        <div className={styles.deviceGrid} aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className={styles.skelCard} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.stateCard} role="alert">
        <p className={styles.stateTitle}>Learning devices</p>
        <p className={styles.stateDesc}>
          We couldn&apos;t load the device ledger. Please check your internet
          connection and try again.
        </p>
        <Button size="sm" variant="outline" disabled={isRefetching} onClick={onRetry}>
          {isRefetching ? <Loader2 className={styles.spin} aria-hidden="true" /> : null}
          {isRefetching ? "Loading…" : "Try again"}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.board} aria-label="Learning devices">
      <div className={styles.toolbar}>
        <p className={styles.count} aria-live="polite">
          {total} device{total === 1 ? "" : "s"}
          {isBackground ? " · Syncing…" : ""}
        </p>
        <div className={styles.headerActions}>
          <InputGroup className={`${styles.searchGroup} h-8 rounded-[16px]`}>
            <InputGroupInput
              className="h-8 py-0 text-xs"
              placeholder="Search devices..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Search serial, student, or LRN"
            />
            <InputGroupAddon className="py-0">
              <SearchIcon className="size-3.5" />
            </InputGroupAddon>
          </InputGroup>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
                {filter === "all" ? "Status" : statusLabel}
                {filter !== "all" && activeOption ? (
                  <span
                    className={styles.filterDot}
                    style={{ backgroundColor: activeOption.color }}
                    aria-hidden
                  />
                ) : null}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[9.5rem]">
              {STATUS_OPTIONS.map((item) => (
                <DropdownMenuCheckboxItem
                  key={item.value}
                  checked={filter === item.value}
                  onCheckedChange={() => onFilterChange(item.value)}
                  className="whitespace-nowrap"
                >
                  <span
                    className={styles.optionDot}
                    style={{ backgroundColor: item.color }}
                    aria-hidden
                  />
                  {item.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={onClear}
            >
              Clear
            </Button>
          ) : null}

          <Button
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={onIssueDevice}
          >
            <Plus className="size-3.5" aria-hidden />
            Issue device
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>No devices match the current filters.</p>
      ) : (
        <ul className={styles.deviceGrid}>
          {rows.map((row) => (
            <DeviceCard
              key={row.id}
              row={row}
              returning={returningId === row.id}
              onRecordReturn={onRecordReturn}
            />
          ))}
        </ul>
      )}

      <Pagination
        currentPage={page}
        totalItems={total}
        onPageChange={(p) => onPageChange(p)}
      />
    </div>
  );
}
