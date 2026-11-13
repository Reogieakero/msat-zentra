"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarPlus,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  FileText,
  Flag,
  Hourglass,
  SearchIcon,
  Send,
} from "lucide-react";
import { NurseEmptyState } from "../../components/NurseEmptyCard";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightCallout } from "@/components/ui/insight-callout";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { useNowMs } from "../../overview/components/use-now-ms";
import { NurseStartHandlingDialog } from "../../overview/components/NurseStartHandlingDialog";
import { ScheduleSessionDialog } from "../../referrals/components/NurseSessionDialogs";
import {
  activeSessionOf,
  caseStage,
  latestActionOf,
} from "../../referrals/components/nurse-referrals-format";
import { deriveActionStatus } from "@/services/nurse/labels";
import { formatElapsedShort, msSinceDate } from "@/lib/clock";
import { Pagination } from "@/components/shared/pagination";
import type {
  NurseAlertItem,
  NurseQueueRow,
  NurseRiskLevel,
} from "@/services/nurse/nurse.types";
import styles from "./nurse-alerts.module.css";

/* Rectangle pills (rounded-md) shared by the kanban rows — same values as the
   guidance alerts board, so both desks read identically. */
const PILL_BASE =
  "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const PILL_MUTED = "bg-muted text-muted-foreground";
const PILL_SECONDARY = "bg-secondary text-secondary-foreground";

type RiskFilter = "" | "High" | "Moderate";

/** Server-side case-type filter — matches the API's ?track= param. */
export type TypeTrack = "adm" | "clinic";

/* Risk levels offered by the risk tab strip — High / Moderate only (plus the
   reset tab); low-risk cases aren't actionable on this desk. */
const RISK_OPTIONS: { value: RiskFilter; label: string }[] = [
  { value: "", label: "All risks" },
  { value: "High", label: "High" },
  { value: "Moderate", label: "Moderate" },
];

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

  const tone = level === "High" ? "red" : level === "Moderate" ? "amber" : "green";
  return (
    <Pill tone={tone} label="Risk level">
      {level}
    </Pill>
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

/** Renders the latest-action glyph from its label. Branches inline (like the
    guidance board's ActionGlyph) so no component is created during render. */
export function ActionGlyph({ label, className }: { label: string; className?: string }) {
  const text = label.toLowerCase();
  const props = { className, "aria-hidden": true } as const;
  if (text.includes("booked")) return <CalendarPlus {...props} />;
  if (text.includes("moved")) return <CalendarClock {...props} />;
  if (text.includes("done") || text.includes("resolv")) return <CircleCheck {...props} />;
  if (text.includes("cancel") || text.includes("reject")) return <CircleX {...props} />;
  if (text.includes("documentation") || text.includes("filed") || text.includes("note"))
    return <FileText {...props} />;
  if (text.includes("follow")) return <Flag {...props} />;
  if (text.includes("accept")) return <Check {...props} />;
  if (
    text.includes("escalat") ||
    text.includes("sent") ||
    text.includes("endors") ||
    text.includes("ready") ||
    text.includes("forward") ||
    text.includes("specialist") ||
    text.includes("adm process") ||
    text.includes("intervention")
  )
    return <Send {...props} />;
  if (text.includes("review") || text.includes("needs")) return <Eye {...props} />;
  if (text.includes("waiting") || text.includes("information")) return <Hourglass {...props} />;
  return <Bell {...props} />;
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
      actions={
        <div
          className="flex max-w-[70vw] flex-wrap items-center justify-end gap-2"
          aria-hidden="true"
        >
          <Skeleton className={styles.skelSearch} />
        </div>
      }
      headerCenter={
        <div
          className={`${styles.filterRow} ${styles.filterRowScroll} max-w-[52vw]`}
          aria-hidden="true"
        >
          <Skeleton className={styles.skelTab} />
          <Skeleton className={styles.skelTab} />
          <span className={styles.filterDivider}>|</span>
          <Skeleton className={styles.skelTab} />
          <Skeleton className={styles.skelTab} />
          <Skeleton className={styles.skelTab} />
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
          <li key={i} className={styles.skeletonRow} aria-hidden="true">
            <div className={styles.caseStudent}>
              <Skeleton className={styles.skelAvatar} />
              <div className={styles.caseIdentity}>
                <Skeleton className={styles.skelCaseName} />
                <div className={styles.caseSubRow}>
                  <Skeleton className={styles.skelPillShort} />
                  <Skeleton className={styles.skelPillShort} />
                </div>
              </div>
            </div>
            <div className={styles.caseStatusCell}>
              <Skeleton className={styles.skelSplitPill} />
            </div>
            <div className={styles.caseTimeCell}>
              <Skeleton className={styles.skelPillShort} />
            </div>
            <div className={styles.caseActions}>
              <Skeleton className={styles.skelKebab} />
            </div>
          </li>
        ))}
      </ul>
    </KanbanBoard>
  );
}

/* Status → text tone for the split status|risk pill (same palette as the
   guidance alerts board: green done/endorsed, red rejected/escalated, blue
   booked/follow-up, amber needs review). */
const STATUS_TEXT_TONE: Record<string, string> = {
  endorsed: "text-green-600 dark:text-green-400",
  done: "text-green-600 dark:text-green-400",
  done_session: "text-green-600 dark:text-green-400",
  rejected: "text-red-600 dark:text-red-400",
  escalated: "text-red-600 dark:text-red-400",
  needs_review: "text-amber-600 dark:text-amber-400",
  booked: "text-blue-600 dark:text-blue-400",
  followup: "text-blue-600 dark:text-blue-400",
};

function riskTextTone(level: NurseRiskLevel | undefined): string {
  if (level === "High") return "text-red-600 dark:text-red-400";
  if (level === "Moderate") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/** Colour code for the latest-action glyph — same semantic palette as the
    guidance alerts board's `actionTone` (red = escalated/sent, green = done,
    blue = booked, amber = waiting/follow-up). */
function latestActionTone(label: string): string {
  const text = label.toLowerCase();
  if (text.includes("cancel") || text.includes("reject") || text.includes("escalat") || text.includes("sent"))
    return "text-red-600 dark:text-red-400";
  if (text.includes("done") || text.includes("resolv") || text.includes("accept") || text.includes("ready"))
    return "text-green-600 dark:text-green-400";
  if (text.includes("booked")) return "text-blue-600 dark:text-blue-400";
  if (
    text.includes("waiting") ||
    text.includes("information") ||
    text.includes("follow") ||
    text.includes("moved") ||
    text.includes("review") ||
    text.includes("needs")
  )
    return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/** Track lead pill left of the mascot, same as the guidance alerts rows. */
function RowTypeLabel({ type }: { type: string }) {
  const adm = type === "ADM";
  return (
    <>
      <span
        className={`${styles.caseTypePill} ${
          adm
            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
            : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        }`}
        aria-label="Case type"
      >
        {adm ? "ADM" : "Clinic"}
      </span>
      <span className={styles.caseSeparator} aria-hidden="true">
        |
      </span>
    </>
  );
}

/**
 * Clinic booking control — the nurse equivalent of the guidance board's
 * "Book session" button. Pending/escalated cases open the review overlay
 * (accept + optional first session); an already-handled case with no live
 * booking opens the plain schedule dialog. A live booking is already surfaced
 * by the row's status pill, so no extra control is shown (guidance parity).
 */
function ClinicBookingControl({
  row,
  onChanged,
}: {
  row: NurseQueueRow;
  onChanged: () => void;
}) {
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const stage = caseStage(row);
  const closed = stage.key === "done" || stage.key === "cancelled" || stage.key === "reject";
  if (row.type === "ADM" || closed) return null;

  // Guidance drops the booking control once a session is scheduled — the
  // status pill already says "Booked session".
  if (activeSessionOf(row.sessions)) return null;

  const needsReview = row.status === "pending" || row.status === "escalated";
  return (
    <>
      <Button
        type="button"
        size="xs"
        variant="default"
        className="h-6 shrink-0 gap-1 px-2 text-[0.6875rem] font-semibold"
        onClick={(event) => {
          event.stopPropagation();
          if (needsReview) setReviewOpen(true);
          else setScheduleOpen(true);
        }}
        aria-label={`Book a session for ${row.student}`}
      >
        <CalendarPlus size={13} aria-hidden />
        Book session
      </Button>
      {needsReview ? (
        <NurseStartHandlingDialog
          row={row}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          onChanged={onChanged}
        />
      ) : (
        <ScheduleSessionDialog
          row={row}
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

/** One case line: type lead + identity, status|risk split pill, referred time,
    latest-action glyph and the clinic booking control. Mirrors the guidance
    alerts board's row so both desks read the same way. */
function NurseAlertRow({
  alert,
  index,
  riskLevel,
  riskLoading,
  nowMs,
  onChanged,
}: {
  alert: NurseAlertItem;
  index: number;
  riskLevel: NurseRiskLevel | undefined;
  riskLoading: boolean;
  nowMs: number;
  onChanged: () => void;
}) {
  const router = useRouter();
  const row = alert.row;
  const status = deriveActionStatus(
    row.type,
    row.status,
    row.sessions,
    row.dismissedByRole,
  );
  const latest = latestActionOf(row, alert);
  const doneCount = row.sessions.filter((s) => s.status === "completed").length;
  const stage = caseStage(row);
  const closed = stage.key === "done" || stage.key === "cancelled" || stage.key === "reject";
  const referredMs = msSinceDate(row.referredAt, nowMs);
  const homeBase =
    row.type === "ADM" ? "/nurse/referrals/adm" : "/nurse/referrals/clinic";
  const seeMoreHref = `${homeBase}?highlight=${row.id}`;

  const open = () => router.push(seeMoreHref);

  return (
    <li
      className={`${styles.caseRow} ${styles.caseRowInteractive}`}
      style={{ animationDelay: `${450 + Math.min(index, 11) * 140}ms` }}
      tabIndex={0}
      aria-label={`Open case details for ${row.student}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
    >
      <div className={styles.caseStudent}>
        <RowTypeLabel type={row.type} />
        <StudentMascot
          name={row.student}
          seed={row.lrn}
          character={row.mascot ?? undefined}
          size={32}
        />
        <div className={styles.caseIdentity}>
          <p className={styles.studentName}>{row.student}</p>
          <p className={styles.cellSub}>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Pill className="tabular-nums" tabIndex={0} aria-label="LRN">
                    {row.lrn}
                  </Pill>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  <span className="font-medium">LRN</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {row.grade !== "—" ? (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Pill
                      tone="amber"
                      tabIndex={0}
                      aria-label={`Grade level ${row.grade}`}
                    >
                      {row.section}
                    </Pill>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    <span className="font-medium">{row.grade}</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </p>
        </div>
      </div>

      <div className={styles.caseStatusCell}>
        <span className={styles.splitPill}>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`${styles.splitPart} ${STATUS_TEXT_TONE[status.key] ?? "text-foreground"}`}
                  tabIndex={0}
                  aria-label="Status"
                >
                  {status.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                <span className="font-medium">Status</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className={styles.splitDivider} aria-hidden="true" />
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`${styles.splitPart} ${riskTextTone(riskLevel)}`}
                  tabIndex={0}
                  aria-label="Risk level"
                >
                  {riskLoading && !riskLevel ? "…" : (riskLevel ?? "—")}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                <span className="font-medium">Risk level</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      </div>

      <div className={styles.caseTimeCell}>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`${PILL_BASE} ${PILL_SECONDARY} tabular-nums`}
                tabIndex={0}
                aria-label={
                  referredMs === null
                    ? "Referred time unknown"
                    : `Referred ${formatElapsedShort(referredMs)} ago`
                }
              >
                <Clock size={11} aria-hidden />
                {referredMs === null ? "—" : `${formatElapsedShort(referredMs)} ago`}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span className="font-medium">Referred at</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div
        className={styles.caseActions}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {doneCount > 0 && !closed ? (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`${PILL_BASE} ${PILL_MUTED} tabular-nums`}
                  tabIndex={0}
                  aria-label="Sessions done"
                >
                  {doneCount} session{doneCount === 1 ? "" : "s"} done
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                <span className="font-medium">Sessions done</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={styles.actionIconButton}
                aria-label={latest.label}
                tabIndex={0}
              >
                <ActionGlyph
                  label={latest.label}
                  className={`${styles.actionIcon} ${latestActionTone(latest.label)}`}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span className="font-medium">{latest.label}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ClinicBookingControl row={row} onChanged={onChanged} />
      </div>
    </li>
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
  const nowMs = useNowMs();
  const query = controlledQuery ?? internalQuery;
  const setQuery = onQueryChange ?? setInternalQuery;

  const filtered = React.useMemo(() => {
    // Filter the loaded page instantly as the nurse types (same feel as the
    // teacher desks); the debounced server query then swaps in matches from
    // the rest of the desk.
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      if (risk !== "") {
        const level = a.studentId ? riskByStudent[a.studentId] : undefined;
        if (level !== risk) return false;
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
  }, [alerts, query, risk, riskByStudent]);

  const total = serverPaged ? (totalProp ?? filtered.length) : filtered.length;
  const hasActiveFilters = query.trim() !== "" || risk !== "";
  const trackLabel = track === "adm" ? "ADM cases" : "Clinic cases";
  const emptyFiltered = (alerts.length === 0 || filtered.length === 0) && hasActiveFilters;

  return (
    <KanbanBoard
      title="Referred cases"
      icon={
        <span className="text-primary" aria-hidden>
          <BellRing size={14} />
        </span>
      }
      ariaLabel="Referred cases"
      description={`${trackLabel} on your desk — ${total} case${total === 1 ? "" : "s"}${
        serverPaged &&
        unfilteredTotal !== undefined &&
        unfilteredTotal !== total
          ? ` (of ${unfilteredTotal} on your desk)`
          : ""
      }.`}
      headerCenter={
        /* Board-header filter strip (centered like the principal schedule
           selector): ADM/Clinic type tabs (amber), a rule, then the risk pill
           tabs (blue when active). Inline tabs — no dropdown. */
        <div className={`${styles.filterRow} ${styles.filterRowScroll} max-w-[52vw]`}>
          <div
            className={styles.filterGroup}
            role="group"
            aria-label="Filter cases by desk"
          >
            <button
              type="button"
              aria-pressed={track === "adm"}
              onClick={() => onTrackChange("adm")}
              className={styles.filterButton}
            >
              <Pill tone={track === "adm" ? "amber" : "neutral"}>ADM</Pill>
            </button>
            <button
              type="button"
              aria-pressed={track === "clinic"}
              onClick={() => onTrackChange("clinic")}
              className={styles.filterButton}
            >
              <Pill tone={track === "clinic" ? "amber" : "neutral"}>
                Clinic
              </Pill>
            </button>
          </div>
          <span className={styles.filterDivider} aria-hidden>
            |
          </span>
          <div
            className={styles.filterGroup}
            role="group"
            aria-label="Filter cases by risk level"
          >
            {RISK_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={risk === option.value}
                onClick={() => {
                  setRisk(option.value);
                }}
                className={styles.filterButton}
              >
                <Pill tone={risk === option.value ? "blue" : "neutral"}>
                  {option.label}
                </Pill>
              </button>
            ))}
          </div>
        </div>
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
          {filtered.map((alert, i) => (
            <NurseAlertRow
              key={alert.key}
              alert={alert}
              index={i}
              riskLevel={
                alert.studentId ? riskByStudent[alert.studentId] : undefined
              }
              riskLoading={riskLoading}
              nowMs={nowMs}
              onChanged={onChanged}
            />
          ))}
        </ul>
      ) : emptyFiltered ? (
        <div className="flex w-full justify-center py-6">
          <InsightCallout role="status" className="w-full max-w-xl text-left">
            <strong>No cases match your search.</strong> Try a different name,
            LRN, or category — or clear the search to see every referred case.
          </InsightCallout>
        </div>
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
