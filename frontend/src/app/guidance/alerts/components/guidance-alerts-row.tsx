"use client";
import * as React from "react";
import {
  Bell,
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
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Pill } from "@/components/ui/pill";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type { GuidanceRiskLevel } from "@/services/guidance/guidance.types";
import { formatActionTime, rowStatusLabel } from "../../referrals/components/guidance-referrals-format";
import { GuidanceBookedSessionButton } from "./GuidanceAlertsRowActions";
import { formatElapsedShort, msSinceDate as msSince } from "@/lib/clock";
import { pipelineStatus } from "../../interventions/components/intervention-row-helpers";
import { referralStatusVariant, rowLatest, type GuidanceAlertRow } from "./guidance-alerts-helpers";
import styles from "./guidance-alerts-table.module.css";

/* Rectangle pills (rounded-md) shared by the kanban rows — tinted surfaces,
   no solid borders. */
const PILL_BASE =
  "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const PILL_MUTED = "bg-muted text-muted-foreground";
const PILL_SECONDARY = "bg-secondary text-secondary-foreground";

export function RiskBadge({ level }: { level: GuidanceRiskLevel | undefined }) {
  if (!level) return <span className={styles.noRisk}>—</span>;
  const variant =
    level === "High" ? "red" : level === "Moderate" ? "amber" : "outline";
  return (
    <Badge variant={variant} className="rounded-md">
      {level}
    </Badge>
  );
}
/** Row type lead — a rectangle pill left of the mascot, separated by a rule. */
function RowTypeLabel({ type }: { type: "ADM" | "Counseling" | "Intervention" }) {
  const tone =
    type === "ADM"
      ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
      : type === "Counseling"
        ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
        : "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return (
    <>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`${styles.caseTypePill} ${tone}`} tabIndex={0} aria-label="Case type">
              {type}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            <span className="font-medium">Case type</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span className={styles.caseSeparator} aria-hidden="true">
        |
      </span>
    </>
  );
}

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

const STATUS_TONE: Record<string, string> = {
  amber: "text-amber-600 dark:text-amber-400",
  default: "text-foreground",
  success: "text-green-600 dark:text-green-400",
  destructive: "text-red-600 dark:text-red-400",
  secondary: "text-muted-foreground",
  outline: "text-foreground",
};

function riskTone(level: GuidanceRiskLevel | undefined): string {
  if (level === "High") return "text-red-600 dark:text-red-400";
  if (level === "Moderate") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

/**
 * Colour code for the latest-action glyph — same semantic palette as the
 * status pill (green = closed/done, red = escalated, blue = booked, amber =
 * waiting/follow-up) so the right-hand icons read at a glance.
 */
function actionTone(label: string): string {
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

/** One split pill — status on the left, risk on the right, `|`-style divider. */
function StatusRiskPill({
  status,
  variant,
  riskLevel,
}: {
  status: string;
  variant: string;
  riskLevel: GuidanceRiskLevel | undefined;
}) {
  return (
    <span className={styles.splitPill}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`${styles.splitPart} ${STATUS_TONE[variant] ?? "text-foreground"}`}
              tabIndex={0}
              aria-label="Status"
            >
              {status}
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
              className={`${styles.splitPart} ${riskTone(riskLevel)}`}
              tabIndex={0}
              aria-label="Risk level"
            >
              {riskLevel ?? "—"}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            <span className="font-medium">Risk level</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

/**
 * One kanban row per case: mascot + student identity on the left, rectangle
 * pills (type / status / risk / latest action) in the middle, kebab menu on
 * the right. Replaces the old table row so the data reads like the nurse
 * overview boards.
 */
export function CaseKanbanRow({
  row,
  riskLevel,
  now,
  onOpen,
  onBook,
}: {
  row: GuidanceAlertRow;
  riskLevel: GuidanceRiskLevel | undefined;
  now: number;
  onOpen: () => void;
  onBook?: () => void;
}) {
  const latest = rowLatest(row);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };
  const interactiveProps = {
    className: `${styles.caseRow} ${styles.caseRowInteractive}`,
    onClick: onOpen,
    onKeyDown: handleKeyDown,
    tabIndex: 0,
  } as const;

  if (row.kind === "intervention") {
    const item = row.item;
    const iv = item.intervention;
    const detectedRaw = item.detectedAt || iv?.createdAt || "";
    const detectedText = detectedRaw ? formatActionTime(detectedRaw) : "Just now";
    const detectedMs = detectedRaw ? (msSince(detectedRaw, now) ?? 0) : 0;
    const outcome = iv?.outcomeStatus ?? "ongoing";
    const doneCount = iv?.completedSessions ?? 0;
    const scheduledCount =
      iv?.sessions.filter((s) => s.status === "scheduled").length ?? 0;
    // Same pipeline labels as the Interventions desk, so an auto-flagged case
    // with no booked session reads "No action yet" instead of "Ongoing".
    const pipeline = pipelineStatus(item, iv, scheduledCount, doneCount);
    const statusText = pipeline.label;
    const statusVar =
      pipeline.variant === "green"
        ? "success"
        : pipeline.variant === "warning"
          ? "amber"
          : pipeline.variant;
    return (
      <li {...interactiveProps} aria-label={`Open case details for ${item.student}`}>
        <div className={styles.caseStudent}>
          <RowTypeLabel type="Intervention" />
          <StudentMascot name={item.student} seed={item.lrn} size={32} />
          <div className={styles.caseIdentity}>
            <p className={styles.studentName}>{item.student}</p>
            <p className={styles.cellSub}>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Pill className="tabular-nums" tabIndex={0} aria-label="LRN">
                      {item.lrn}
                    </Pill>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    <span className="font-medium">LRN</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Pill
                      tone="amber"
                      tabIndex={0}
                      aria-label={`Grade level ${item.grade || "unknown"}`}
                    >
                      {item.section}
                    </Pill>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    <span className="font-medium">{item.grade || "—"}</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
          </div>
        </div>
        <div className={styles.caseStatusCell}>
          <StatusRiskPill
            status={statusText}
            variant={statusVar}
            riskLevel={riskLevel}
          />
        </div>
        <div className={styles.caseTimeCell}>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`${PILL_BASE} ${PILL_SECONDARY} tabular-nums`}
                  tabIndex={0}
                  aria-label={`Detected at ${detectedText}, ${
                    detectedMs < 60_000 ? "just now" : `${formatElapsedShort(detectedMs)} ago`
                  }`}
                >
                  <Clock size={11} aria-hidden />
                  {detectedMs < 60_000 ? "just now" : `${formatElapsedShort(detectedMs)} ago`}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                <span className="font-medium">Detected at</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className={styles.caseActions}>
          {doneCount > 0 && outcome === "ongoing" ? (
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
                    className={`${styles.actionIcon} ${actionTone(latest.label)}`}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                <span className="font-medium">{latest.label}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <GuidanceBookedSessionButton item={item} onBeforeOpen={onBook} />
        </div>
      </li>
    );
  }

  const r = row.referral;
  const doneCount = r.sessions.filter((s) => s.status === "completed").length;
  const allDone = doneCount > 0 && !r.sessions.some((s) => s.status === "scheduled");
  const statusText = allDone ? "Done" : rowStatusLabel(r.type, r.status, r);
  const statusVar = allDone ? "success" : referralStatusVariant(r.type, r.status);
  // The timestamp column reports when the case entered the desk (referral
  // date), not the latest action — that stays on the action glyph tooltip.
  const referredRaw = r.date || "";
  const referredText = referredRaw ? formatActionTime(referredRaw) : "";
  const referredMs = referredRaw ? msSince(referredRaw, now) : null;
  return (
    <li {...interactiveProps} aria-label={`Open case details for ${r.student}`}>
      <div className={styles.caseStudent}>
        <RowTypeLabel type={r.type === "ADM" ? "ADM" : "Counseling"} />
        <StudentMascot name={r.student} seed={r.lrn} size={32} />
        <div className={styles.caseIdentity}>
          <p className={styles.studentName}>{r.student}</p>
          <p className={styles.cellSub}>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Pill className="tabular-nums" tabIndex={0} aria-label="LRN">
                    {r.lrn}
                  </Pill>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  <span className="font-medium">LRN</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Pill
                    tone="amber"
                    tabIndex={0}
                    aria-label={`Grade level ${r.grade || "unknown"}`}
                  >
                    {r.section}
                  </Pill>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  <span className="font-medium">{r.grade || "—"}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
        </div>
      </div>
      <div className={styles.caseStatusCell}>
        <StatusRiskPill status={statusText} variant={statusVar} riskLevel={riskLevel} />
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
                    : `Referred at ${referredText}, ${formatElapsedShort(referredMs)} ago`
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
      <div className={styles.caseActions}>
        {doneCount > 0 && !allDone ? (
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
                  className={`${styles.actionIcon} ${actionTone(latest.label)}`}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span className="font-medium">{latest.label}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </li>
  );
}
