"use client";

import * as React from "react";
import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  FileText,
  Flag,
  Hourglass,
  Inbox,
  SearchIcon,
  SearchX,
  Send,
  Stethoscope,
} from "lucide-react";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { NurseActionBadge, waitingElapsed } from "../../overview/components/nurse-action-badge";
import { useNowMs } from "../../overview/components/use-now-ms";
import { NurseQueueRowActions } from "../../overview/components/NurseQueueRowActions";
import { anecdotalCategoryPillClass } from "../../referrals/components/nurse-referrals-format";
import { Pagination } from "@/components/shared/pagination";
import { cn } from "@/lib/utils";
import { deriveActionStatus } from "@/services/nurse/labels";
import type {
  NurseAlertItem,
  NurseRiskLevel,
} from "@/services/nurse/nurse.types";
import styles from "./nurse-alerts.module.css";

type RiskFilter = "" | NurseRiskLevel | "none";

/** Server-side case-type filter — matches the API's ?track= param. */
export type TypeTrack = "" | "adm" | "clinic";

/* Single shared pill metric for the case rows — rectangle pills (rounded-md),
   same as the overview's latest-referrals board. */
const PILL_BASE =
  "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const PILL_SECONDARY = "border-border bg-secondary text-secondary-foreground";
const PILL_MUTED = "border-border bg-muted text-muted-foreground";

const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: "", label: "All risks" },
  { value: "High", label: "High" },
  { value: "Moderate", label: "Moderate" },
  { value: "Low", label: "Low" },
  { value: "none", label: "No level" },
];

/* Legend dots for the risk filter menu — same colours as the row risk
   badges (High red, Moderate amber, Low green, no snapshot muted). */
const RISK_DOT_CLASS: Record<RiskFilter, string> = {
  "": "border border-muted-foreground/50",
  High: "bg-red-500",
  Moderate: "bg-amber-500",
  Low: "bg-green-500",
  none: "bg-muted-foreground/40",
};

/* Amber "selected" style shared by the header's ADM / Clinic icon toggles
   and the centered stage tabs. The dark: classes re-override the outline
   variant's dark input tint (which would otherwise win in dark mode). */
const SELECTED_AMBER_CLASS =
  "border-amber-500/40 bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 hover:text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/25 dark:hover:text-amber-400";

/* Canonical order for the stage tabs — review first, then the active
   stages, then the closed ones; unknown keys sink to the end. */
const STAGE_ORDER = [
  "needs_review",
  "escalated",
  "booked",
  "endorsed",
  "followup",
  "done_session",
  "in_progress",
  "info_requested",
  "done",
  "rejected",
];

function stageRank(key: string): number {
  const i = STAGE_ORDER.indexOf(key);
  return i === -1 ? STAGE_ORDER.length : i;
}

/* Stage tab pills — rectangle pills matching the row pill metric, but
   interactive (hover / focus ring / pressed state). */
const STAGE_TAB_CLASS =
  "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground whitespace-nowrap outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const STAGE_TAB_ACTIVE_CLASS = `${SELECTED_AMBER_CLASS} font-semibold`;

export function statusVariant(
  status: string
): "amber" | "blue" | "green" | "red" | "secondary" | "outline" {
  switch (status) {
    case "pending":
      return "amber";
    case "in_progress":
      return "blue";
    case "follow_up":
      return "blue";
    case "info_requested":
      return "outline";
    case "escalated":
      return "red";
    case "resolved":
      return "green";
    case "dismissed":
      return "red";
    default:
      return "outline";
  }
}

export const ACTION_STATUS_VARIANT: Record<
  string,
  "amber" | "blue" | "green" | "red" | "secondary" | "outline"
> = {
  endorsed: "green",
  done: "green",
  done_session: "green",
  booked: "blue",
  followup: "blue",
  rejected: "red",
  needs_review: "amber",
  escalated: "red",
};

export function RiskBadge({
  level,
  loading = false,
}: {
  level: NurseRiskLevel | undefined;
  loading?: boolean;
}) {
  if (loading && !level)
    return (
      <span className={styles.noRisk} role="status" aria-label="Loading risk level">
        …
      </span>
    );
  if (!level) return <span className={styles.noRisk}>—</span>;

  const variant = level === "High" ? "red" : level === "Moderate" ? "amber" : "green";
  return (
    <Badge variant={variant} className="rounded-md">
      {level}
    </Badge>
  );
}

export type ActionIcon = React.ComponentType<{ className?: string }>;

export function actionIconFor(label: string): ActionIcon {
  const text = label.toLowerCase();
  if (text.includes("booked")) return CalendarPlus;
  if (text.includes("moved")) return CalendarClock;
  if (text.includes("done") || text.includes("resolv")) return CircleCheck;
  if (text.includes("cancel") || text.includes("reject")) return CircleX;
  if (text.includes("documentation") || text.includes("filed")) return FileText;
  if (text.includes("follow")) return Flag;
  if (text.includes("accept")) return Check;
  if (
    text.includes("escalat") ||
    text.includes("sent") ||
    text.includes("endors") ||
    text.includes("ready") ||
    text.includes("forward")
  )
    return Send;
  if (text.includes("review") || text.includes("needs")) return Eye;
  if (text.includes("waiting") || text.includes("information")) return Hourglass;
  return Bell;
}

/** Kanban-shaped loading placeholder — the board shell with its rows as
    skeleton bars, so the load and the loaded page read as one surface. */
export function NurseAlertsBoardSkeleton() {
  return (
    <KanbanBoard
      title={<Skeleton className={styles.skelCardTitle} />}
      icon={
        <span className="text-primary" aria-hidden>
          <BellRing size={14} />
        </span>
      }
      ariaLabel="Loading referred cases"
      description={<Skeleton className={styles.skelPanelDesc} />}
      headerCenter={
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <Skeleton className={styles.skelTab} />
          <Skeleton className={styles.skelTab} />
          <Skeleton className={styles.skelTab} />
        </span>
      }
      actions={
        <div
          className="flex max-w-[70vw] flex-wrap items-center justify-end gap-2"
          aria-hidden="true"
        >
          <Skeleton className={styles.skelSearch} />
          <Skeleton className={styles.skelDrop} />
          <Skeleton className={styles.skelIconBtn} />
          <Skeleton className={styles.skelIconBtn} />
        </div>
      }
      footer={
        <div className={styles.skelPager} aria-hidden="true">
          <Skeleton className={styles.skelRange} />
          <div className={styles.skelPagerBtns}>
            <Skeleton className={styles.skelBtn} />
            <Skeleton className={styles.skelPageLabel} />
            <Skeleton className={styles.skelBtn} />
          </div>
        </div>
      }
    >
      <ul className={styles.caseList}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i} className={styles.caseRow} aria-hidden="true">
            <div className={styles.caseInfo}>
              <Skeleton className={styles.skelAvatar} />
              <Skeleton className={styles.skelCaseName} />
              <Skeleton className={styles.skelPill} />
            </div>
            <div className={styles.cellActions}>
              <Skeleton className={styles.skelPill} />
              <Skeleton className={styles.skelPillShort} />
              <Skeleton className={styles.skelKebab} />
            </div>
          </li>
        ))}
      </ul>
    </KanbanBoard>
  );
}

export function NurseAlertsBoard({
  alerts,
  riskByStudent,
  riskLoading = false,
  onChanged,
  query: controlledQuery,
  onQueryChange,
  track,
  onTrackChange,
  page,
  total: totalProp,
  unfilteredTotal,
  onPageChange,
  serverPaged = false,
}: {
  alerts: NurseAlertItem[];
  riskByStudent: Record<string, NurseRiskLevel>;
  riskLoading?: boolean;
  onChanged: () => void;

  query?: string;
  onQueryChange?: (v: string) => void;

  track: TypeTrack;
  onTrackChange: (track: TypeTrack) => void;

  page?: number;
  total?: number;
  unfilteredTotal?: number;
  onPageChange?: (p: number) => void;
  serverPaged?: boolean;
}) {
  const [internalQuery, setInternalQuery] = React.useState("");
  const [risk, setRisk] = React.useState<RiskFilter>("");
  const [stage, setStage] = React.useState("");
  const nowMs = useNowMs();
  const query = controlledQuery ?? internalQuery;
  const setQuery = onQueryChange ?? setInternalQuery;

  const filtered = React.useMemo(() => {
    const q = serverPaged ? "" : query.trim().toLowerCase();
    return alerts.filter((a) => {
      if (risk !== "") {
        const level = a.studentId ? riskByStudent[a.studentId] : undefined;
        if (risk === "none") {
          if (level !== undefined) return false;
        } else if (level !== risk) {
          return false;
        }
      }
      if (
        q !== "" &&
        !`${a.row.student} ${a.row.lrn} ${a.row.section} ${a.row.reason} ${a.row.category}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [alerts, query, risk, riskByStudent, serverPaged]);

  // Stage tabs (centered in the board header): one pill per stage that
  // actually has cases in the filtered rows — a stage with no cases never
  // renders a pill, and the strip hides entirely when no stage remains.
  const stageTabs = React.useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const a of filtered) {
      const { key, label } = deriveActionStatus(a.row.type, a.row.status, a.row.sessions);
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { label, count: 1 });
    }
    return [...counts.entries()]
      .map(([key, { label, count }]) => ({ key, label, count }))
      .sort((a, b) => stageRank(a.key) - stageRank(b.key) || a.label.localeCompare(b.label));
  }, [filtered]);

  // Drop the selection while its stage has no cases any more (search / risk
  // changed) or while a lone stage remains — a single tab filters nothing.
  // Derived, not synced in an effect, so no cascading renders.
  const activeStage =
    stageTabs.length > 1 && stageTabs.some((t) => t.key === stage) ? stage : "";

  const visible = React.useMemo(
    () =>
      activeStage === ""
        ? filtered
        : filtered.filter(
            (a) => deriveActionStatus(a.row.type, a.row.status, a.row.sessions).key === activeStage
          ),
    [filtered, activeStage]
  );

  const total = serverPaged ? (totalProp ?? filtered.length) : filtered.length;
  const riskLabel =
    RISK_OPTIONS.find((o) => o.value === risk)?.label ?? "All risks";
  const hasActiveFilters = query.trim() !== "" || risk !== "" || track !== "";
  const trackLabel =
    track === "adm"
      ? "ADM cases"
      : track === "clinic"
        ? "Clinic cases"
        : "Every ADM and clinic matter";
  const emptyFiltered = (alerts.length === 0 || filtered.length === 0) && hasActiveFilters;

  return (
    <KanbanBoard
      title="Referred cases"
      icon={
        <span className="text-primary" aria-hidden>
          <BellRing size={14} />
        </span>
      }
      count={total}
      ariaLabel="Referred cases"
      description={`${trackLabel} on your desk — ${total} case${total === 1 ? "" : "s"}${
        serverPaged &&
        unfilteredTotal !== undefined &&
        unfilteredTotal !== total
          ? ` (of ${unfilteredTotal} on your desk)`
          : ""
      }.`}
      headerCenter={
        stageTabs.length > 1 ? (
          <div
            className="flex max-w-[36vw] items-center gap-1.5 overflow-x-auto"
            role="group"
            aria-label="Filter cases by stage"
          >
            {stageTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={activeStage === tab.key}
                onClick={() => {
                  setStage(activeStage === tab.key ? "" : tab.key);
                }}
                className={cn(
                  STAGE_TAB_CLASS,
                  activeStage === tab.key && STAGE_TAB_ACTIVE_CLASS
                )}
              >
                {tab.label}
                <span className="tabular-nums opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>
        ) : null
      }
      actions={
        <div className="flex max-w-[70vw] flex-wrap items-center justify-end gap-2">
          <InputGroup className="max-w-40 shrink-0 rounded-[16px]">
            <InputGroupInput
              placeholder="Search cases..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              aria-label="Search referred cases"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Filter cases by risk level, currently showing: ${riskLabel}`}
                className={`${styles.filterBtn} ${risk !== "" ? styles.filterActive : ""}`}
              >
                {risk === "" ? "Risk" : riskLabel}
                {risk !== "" && (
                  <span className={styles.filterDot} aria-hidden />
                )}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.filterMenu}>
              {RISK_OPTIONS.map((item, index) => (
                <React.Fragment key={item.label}>
                  <DropdownMenuItem
                    className={cn(
                      "gap-2",
                      risk === item.value &&
                        "bg-accent font-medium text-accent-foreground"
                    )}
                    onSelect={() => {
                      setRisk(item.value);
                    }}
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        RISK_DOT_CLASS[item.value]
                      )}
                      aria-hidden
                    />
                    {item.label}
                  </DropdownMenuItem>
                  {index === 0 && <DropdownMenuSeparator />}
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className={cn(track === "adm" && SELECTED_AMBER_CLASS)}
                aria-pressed={track === "adm"}
                aria-label="Show ADM cases only"
                onClick={() => onTrackChange(track === "adm" ? "" : "adm")}
              >
                <Inbox aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">ADM cases</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className={cn(track === "clinic" && SELECTED_AMBER_CLASS)}
                aria-pressed={track === "clinic"}
                aria-label="Show clinic cases only"
                onClick={() => onTrackChange(track === "clinic" ? "" : "clinic")}
              >
                <Stethoscope aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Clinic cases</TooltipContent>
          </Tooltip>
        </div>
      }
      footer={
        <Pagination
          currentPage={page ?? 1}
          totalItems={serverPaged ? total : filtered.length}
          onPageChange={(p) => onPageChange?.(p)}
        />
      }
    >
      {alerts.length > 0 && filtered.length > 0 ? (
        <ul className={styles.caseList}>
          {visible.map((alert) => {
            const row = alert.row;
            const level = alert.studentId
              ? riskByStudent[alert.studentId]
              : undefined;
            const wait = waitingElapsed(row.referredAt, nowMs);
            const homeBase =
              row.type === "ADM"
                ? "/nurse/referrals/adm"
                : "/nurse/referrals/clinic";
            const seeMoreHref = `${homeBase}?highlight=${row.id}`;
            const viewFormHref =
              row.type === "ADM" && row.referralReady
                ? `${seeMoreHref}&form=1`
                : seeMoreHref;
            return (
              <li key={alert.key} className={styles.caseRow}>
                <div className={styles.caseInfo}>
                  <StudentMascot
                    name={row.student}
                    seed={row.lrn}
                    character={row.mascot ?? undefined}
                    size={32}
                  />
                  <p className={styles.cellMain}>{row.student}</p>
                  <span
                    className={`${PILL_BASE} ${PILL_SECONDARY} tabular-nums`}
                    title={row.lrn}
                  >
                    {row.lrn}
                  </span>
                  {row.grade !== "—" && (
                    <span className={`${PILL_BASE} ${PILL_MUTED}`}>
                      {row.grade}
                    </span>
                  )}
                  {row.category !== "—" && (
                    <span
                      className={`${PILL_BASE} ${
                        anecdotalCategoryPillClass(row.category) ??
                        PILL_SECONDARY
                      }`}
                    >
                      {row.category}
                    </span>
                  )}
                </div>
                <div className={styles.cellActions}>
                  {row.type === "ADM" ? (
                    <Badge variant="blue" className="rounded-md">
                      ADM case
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="rounded-md">
                      Clinic
                    </Badge>
                  )}
                  <NurseActionBadge row={row} className="rounded-md" />
                  <RiskBadge level={level} loading={riskLoading} />
                  {wait !== "—" && (
                    <span
                      className={`${PILL_BASE} ${PILL_MUTED} gap-1 tabular-nums`}
                      title={`Waiting since ${row.date}`}
                    >
                      <Clock size={11} aria-hidden />
                      {wait}
                    </span>
                  )}
                  <NurseQueueRowActions
                    row={row}
                    onChanged={onChanged}
                    seeMoreHref={seeMoreHref}
                    viewFormHref={viewFormHref}
                    viewOnly
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : emptyFiltered ? (
        <NurseEmptyState
          icon={SearchX}
          title="No cases match your search"
          hint="Try a different name or keyword, or clear the search and filters."
        />
      ) : (
        <NurseEmptyState
          icon={BellRing}
          title="No referred cases"
          hint="No referred cases — nothing needs your attention right now."
        />
      )}
    </KanbanBoard>
  );
}
