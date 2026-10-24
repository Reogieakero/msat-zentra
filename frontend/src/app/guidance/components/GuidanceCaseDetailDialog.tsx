"use client";
import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  FileText,
  MapPin,
  User,
} from "lucide-react";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { formatDate, formatTime } from "@/lib/labels/datetime";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import { cn } from "@/lib/utils";
import type { GuidanceReferralItem, GuidanceRiskLevel } from "@/services/guidance/guidance.types";
import type { AtRiskStudentItem } from "@/services/guidance/interventions.types";
import { formatActionTime, rowStatusLabel } from "../referrals/components/guidance-referrals-format";
import { EngineBreakdown } from "../interventions/components/intervention-engine-breakdown";
import { approvalLabel, outcomeLabel, pipelineStatus } from "../interventions/components/intervention-row-helpers";

/** One case shown in the shared guidance detail overlay. */
export type CaseDetailRow =
  | { kind: "referral"; referral: GuidanceReferralItem }
  | { kind: "intervention"; item: AtRiskStudentItem };

/** A counseling session as rendered by the detail overlay. */
export interface CaseDetailSession {
  id: string;
  sessionType: string;
  scheduledAt: string;
  date: string;
  venue: string;
  status: string;
  sessionNotes: string;
  outcome: string;
  cancelReason: string;
}

const PILL =
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/**
 * Pill whose tooltip names the field only (e.g. "Status") — the value is
 * already on the pill itself, so the tooltip stays label-only.
 */
function LabeledPill({
  label,
  className,
  tooltip,
  children,
}: {
  label: string;
  className?: string;
  /** Overrides the tooltip body (defaults to the label only). */
  tooltip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={className} tabIndex={0} aria-label={label}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          <span className="font-medium">{tooltip ?? label}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function riskTone(level: GuidanceRiskLevel | undefined): string {
  if (level === "High") return "bg-red-500/15 text-red-700 dark:text-red-400";
  if (level === "Moderate") return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

function statusTone(variant: string): string {
  switch (variant) {
    case "amber":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "success":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "destructive":
      return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "secondary":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-primary/10 text-primary";
  }
}

function statusToTone(variant: string): string {
  return variant === "green" ? "success" : variant === "warning" ? "amber" : variant;
}

function sessionBadge(status: string) {
  if (status === "completed")
    return (
      <LabeledPill label="Session status" className={cn(PILL, "bg-green-500/15 text-green-700 dark:text-green-400")}>
        Done
      </LabeledPill>
    );
  if (status === "cancelled")
    return (
      <LabeledPill label="Session status" className={cn(PILL, "bg-muted text-muted-foreground")}>
        Cancelled
      </LabeledPill>
    );
  return (
    <LabeledPill label="Session status" className={cn(PILL, "bg-blue-500/15 text-blue-700 dark:text-blue-400")}>
      Scheduled
    </LabeledPill>
  );
}

function SessionList({
  sessions,
  renderActions,
}: {
  sessions: CaseDetailSession[];
  /** Optional per-session action strip (e.g. mark done / reschedule). */
  renderActions?: (session: CaseDetailSession) => React.ReactNode;
}) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-xl bg-muted/60 px-4 py-3 text-[13px] text-muted-foreground">
        No sessions booked yet.
      </p>
    );
  }
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
  );
  const amberPill = cn(PILL, "bg-amber-500/15 text-amber-700 dark:text-amber-400");
  return (
    <ul className="overflow-hidden rounded-xl border border-border bg-card p-1">
      {sorted.map((s) => (
        <li
          key={s.id}
          className="border-b border-border/60 last:border-b-0 transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <User className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <LabeledPill
                label="Session type"
                className={cn(PILL, "bg-blue-500/15 text-blue-700 dark:text-blue-400")}
              >
                {sessionTypeLabel(s.sessionType)}
              </LabeledPill>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <LabeledPill label="Date" className={cn(amberPill, "tabular-nums")}>
                  <Calendar className="size-3" aria-hidden />
                  <time dateTime={s.scheduledAt}>{formatDate(s.date)}</time>
                </LabeledPill>
                <LabeledPill label="Time" className={cn(amberPill, "tabular-nums")}>
                  <Clock className="size-3" aria-hidden />
                  {formatTime(s.scheduledAt)}
                </LabeledPill>
                {s.venue ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden />
                    {s.venue}
                  </span>
                ) : null}
              </p>
            </div>
            {sessionBadge(s.status)}
          </div>
          {(s.status === "completed" && (s.sessionNotes || s.outcome)) ||
          (s.status === "cancelled" && s.cancelReason) ? (
            <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-border/60 bg-muted/40 px-2.5 py-3 text-[13px]">
              {s.status === "completed" && s.sessionNotes ? (
                <>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="text-foreground">{s.sessionNotes}</dd>
                </>
              ) : null}
              {s.status === "completed" && s.outcome ? (
                <>
                  <dt className="text-muted-foreground">Outcome</dt>
                  <dd className="text-foreground">{s.outcome}</dd>
                </>
              ) : null}
              {s.status === "cancelled" && s.cancelReason ? (
                <>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd className="text-foreground">{s.cancelReason}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          {renderActions ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 px-2.5 py-2">
              {renderActions(s)}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[13px] leading-5 text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Shared case-detail overlay used by the guidance alerts board and the
 * interventions queue — same header, pills, sections and footer everywhere.
 */
export function GuidanceCaseDetailDialog({
  row,
  riskLevel,
  onClose,
  actions,
  sessionActions,
  showOpenFullCase = true,
}: {
  row: CaseDetailRow | null;
  riskLevel: GuidanceRiskLevel | undefined;
  onClose: () => void;
  /** Optional footer actions (start/book, approve, record outcome, …). */
  actions?: React.ReactNode;
  /** Optional per-session action buttons (mark done, reschedule, docs). */
  sessionActions?: (session: CaseDetailSession) => React.ReactNode;
  /** Hide the "Open full case" link when the overlay is already on that page. */
  showOpenFullCase?: boolean;
}) {
  if (!row) return null;

  const isIntervention = row.kind === "intervention";
  const student = isIntervention ? row.item.student : row.referral.student;
  const lrn = isIntervention ? row.item.lrn : row.referral.lrn;
  const grade = isIntervention ? row.item.grade : row.referral.grade;
  const section = isIntervention ? row.item.section : row.referral.section;
  const type = isIntervention ? "Intervention" : row.referral.type === "ADM" ? "ADM" : "Counseling";
  const typeTone =
    type === "Intervention"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
      : "bg-blue-500/15 text-blue-700 dark:text-blue-400";

  let statusText: string;
  let statusVariant: string;
  let detectedText: string;
  let fullCaseHref: string;
  let sessions: CaseDetailSession[] = [];
  let note: string | null = null;
  let approval: string | null = null;
  let outcome: string | null = null;

  if (isIntervention) {
    const item = row.item;
    const iv = item.intervention;
    detectedText = item.detectedAt || iv?.createdAt ? formatActionTime(item.detectedAt || iv?.createdAt || "") : "Just now";
    const doneCount = iv?.completedSessions ?? 0;
    const scheduledCount =
      iv?.sessions.filter((s) => s.status === "scheduled").length ?? 0;
    const pipeline = pipelineStatus(item, iv, scheduledCount, doneCount);
    statusText = pipeline.label;
    statusVariant = statusToTone(pipeline.variant);
    sessions = iv?.sessions ?? [];
    note = [iv?.recommendedAction, iv?.intakeNotes].filter((t) => t && t.trim() !== "").join(" — ") || null;
    approval = iv ? approvalLabel(iv.approvalStatus) : null;
    outcome = iv && iv.outcomeNotes ? iv.outcomeNotes : null;
    fullCaseHref = `/guidance/interventions?highlight=${encodeURIComponent(item.studentKey)}`;
  } else {
    const r = row.referral;
    const doneCount = r.sessions.filter((s) => s.status === "completed").length;
    const allDone = doneCount > 0 && !r.sessions.some((s) => s.status === "scheduled");
    statusText = allDone ? "Done" : rowStatusLabel(r.type, r.status, r);
    statusVariant = allDone ? "success" : "default";
    detectedText = formatActionTime(r.date);
    sessions = r.sessions;
    note = [r.reason, r.recommendations].filter((t) => t && t.trim() !== "").join(" — ") || null;
    fullCaseHref =
      r.type === "ADM"
        ? `/guidance/referrals/adm?highlight=${r.id}`
        : `/guidance/referrals/counseling?highlight=${r.id}`;
  }

  return (
    <KanbanOverlay
      open
      onClose={onClose}
      width="xl"
      title={
        <span className="flex flex-col items-start gap-1">
          <span className="text-sm">{student}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <LabeledPill
              label="LRN"
              className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-secondary-foreground"
            >
              {lrn || "—"}
            </LabeledPill>
            <LabeledPill
              label="Section"
              className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400"
              tooltip={grade || "—"}
            >
              {section || "—"}
            </LabeledPill>
          </span>
        </span>
      }
      icon={<StudentMascot name={student} seed={lrn} size={24} />}
      description={
        <span className="flex w-full items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          Detected {detectedText}
        </span>
      }
      headerActions={
        <span className="flex items-center gap-1.5">
          <LabeledPill label="Case type" className={cn(PILL, typeTone)}>
            {type}
          </LabeledPill>
          <LabeledPill
            label="Status"
            className={cn(
              PILL,
              statusText.toLowerCase().includes("booked")
                ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                : statusTone(statusVariant)
            )}
          >
            {statusText}
          </LabeledPill>
          <LabeledPill label="Risk level" className={cn(PILL, riskTone(riskLevel))}>
            {riskLevel ? `${riskLevel} risk` : "No risk"}
          </LabeledPill>
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5" aria-hidden />
            {sessions.length} session{sessions.length === 1 ? "" : "s"} on record
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
            {showOpenFullCase ? (
              <Link
                href={fullCaseHref}
                className="inline-flex h-6 items-center gap-1.5 rounded-md bg-amber-500 px-2.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-400"
              >
                Open full case
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      }
    >
        <div className="space-y-5 px-1 py-1">
          {note ? (
            <div className="flex items-start gap-3 rounded-xl bg-muted/60 px-4 py-3">
              <FileText className="mt-px size-[18px] shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  Note
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-foreground">{note}</p>
              </div>
            </div>
          ) : null}

          {isIntervention ? (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Why at risk</h3>
                <EngineBreakdown
                  studentKey={row.item.studentKey}
                  factors={row.item.factors}
                  openReferrals={row.item.referralContext.open}
                  closedReferrals={row.item.referralContext.closed}
                  highPriority={row.item.intervention?.priority === "high"}
                />
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Counseling plan</h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {approval ? (
                      <LabeledPill
                        label="Approval"
                        className={cn(PILL, "bg-amber-500/15 text-amber-700 dark:text-amber-400")}
                      >
                        {approval}
                      </LabeledPill>
                    ) : null}
                    {outcome ? (
                      <LabeledPill label="Outcome" className={cn(PILL, "bg-muted text-muted-foreground")}>
                        {outcome}
                      </LabeledPill>
                    ) : null}
                    <LabeledPill
                      label="Plan status"
                      className={cn(PILL, "bg-muted text-muted-foreground")}
                    >
                      {outcomeLabel(row.item.intervention?.outcomeStatus ?? "ongoing")}
                    </LabeledPill>
                  </div>
                </div>
                {row.item.intervention ? (
                  <SessionList sessions={sessions} renderActions={sessionActions} />
                ) : (
                  <p className="rounded-xl bg-muted/60 px-4 py-3 text-[13px] text-muted-foreground">
                    No follow-up yet.
                  </p>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Referral details</h3>
                <dl className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-2">
                  <DetailField label="Category" value={row.referral.category} />
                  <DetailField label="Referred by" value={row.referral.referredBy} />
                  <DetailField label="Date referred" value={formatActionTime(row.referral.date)} />
                  <DetailField label="Location" value={row.referral.location} />
                  <DetailField label="Priority" value={row.referral.priority} />
                  <DetailField label="Confidentiality" value={row.referral.confidentiality} />
                  <DetailField label="Recommendations" value={row.referral.recommendations} />
                  <DetailField label="Resolution" value={row.referral.resolutionSummary} />
                </dl>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Sessions</h3>
                <SessionList sessions={sessions} renderActions={sessionActions} />
              </section>
            </>
          )}
        </div>
    </KanbanOverlay>
  );
}
