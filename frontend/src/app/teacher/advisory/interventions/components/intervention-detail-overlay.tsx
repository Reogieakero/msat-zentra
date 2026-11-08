"use client";

import * as React from "react";
import {
  CalendarClock,
  CalendarDays,
  ClipboardList,
  HeartHandshake,
  MapPin,
  Paperclip,
} from "lucide-react";
import { KanbanOverlay } from "@/components/ui/kanban-overlay";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { outcomeLabel, outcomeTone, riskTone } from "@/lib/labels/status-tone";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import { formatStatus } from "@/lib/labels/text";
import { cn } from "@/lib/utils";
import type {
  AdvisoryInterventionRow,
  AdvisoryInterventionSession,
} from "@/services/teacher/interventions.service";
import {
  approvalTone,
  formatDate,
  formatDateTime,
  sessionStatusTone,
} from "./intervention-row";

const FACTORS: {
  key: keyof AdvisoryInterventionRow["factors"];
  label: string;
  tone: "amber" | "sky" | "rose";
}[] = [
  { key: "academic", label: "Academic", tone: "amber" },
  { key: "attendance", label: "Attendance", tone: "sky" },
  { key: "behavioral", label: "Behavioral", tone: "rose" },
];

function SectionCard({
  icon: Icon,
  title,
  aside,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-3",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <h3 className="m-0 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Icon size={13} className="text-muted-foreground" aria-hidden />
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Fact({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 text-xs font-medium break-words text-foreground">{children}</dd>
    </div>
  );
}

function NoteBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border-l-2 border-primary/40 bg-muted/40 px-2.5 py-2">
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p className="m-0 mt-0.5 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
        {children}
      </p>
    </div>
  );
}

function SessionItem({
  session,
  index,
}: {
  session: AdvisoryInterventionSession;
  index: number;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-muted/20 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary tabular-nums">
          {index + 1}
        </span>
        <span className="text-xs font-semibold text-foreground">
          {sessionTypeLabel(session.sessionType)}
        </span>
        <Pill tone={sessionStatusTone(session.status)} label="Session status">
          {formatStatus(session.status)}
        </Pill>
        {session.attachmentsCount > 0 ? (
          <Pill tone="neutral" label="Attachments">
            <Paperclip size={10} aria-hidden />
            {session.attachmentsCount}
          </Pill>
        ) : null}
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {formatDateTime(session.scheduledAt)}
        </span>
      </div>

      {session.venue ? (
        <p className="m-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin size={11} aria-hidden />
          {session.venue}
        </p>
      ) : null}
      {session.sessionNotes ? (
        <p className="m-0 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
          {session.sessionNotes}
        </p>
      ) : null}
      {session.outcome ? (
        <p className="m-0 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Outcome:</span> {session.outcome}
        </p>
      ) : null}
      {session.cancelReason ? (
        <p className="m-0 text-[11px] text-red-600 dark:text-red-400">
          <span className="font-semibold">Cancelled:</span> {session.cancelReason}
        </p>
      ) : null}
      {session.completedAt ? (
        <p className="m-0 text-[11px] text-muted-foreground">
          Completed {formatDate(session.completedAt)}
        </p>
      ) : null}
    </li>
  );
}

export function InterventionDetailOverlay({
  row,
  onClose,
}: {
  row: AdvisoryInterventionRow | null;
  onClose: () => void;
}) {
  const activeFactors = row ? FACTORS.filter((factor) => row.factors[factor.key]) : [];
  const intervention = row?.intervention ?? null;
  const doneCount =
    intervention?.sessions.filter((session) => session.status === "completed").length ?? 0;
  const scheduledCount =
    intervention?.sessions.filter((session) => session.status === "scheduled").length ?? 0;

  return (
    <KanbanOverlay
      open={!!row}
      onClose={onClose}
      title={row?.name ?? "Intervention"}
      ariaLabel={row ? `Intervention details for ${row.name}` : "Intervention details"}
      icon={<HeartHandshake size={16} aria-hidden />}
      description={
        row
          ? `Detected ${formatDate(row.detectedAt)} · Term follow-up recorded by the guidance desk`
          : undefined
      }
      width="2xl"
    >
      {row ? (
        <div className="flex flex-col gap-3 px-1 pb-1">
          {/* Identity + case status summary */}
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
            <StudentMascot
              name={row.name}
              seed={row.lrn}
              character={row.mascot ?? undefined}
              size={44}
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-semibold text-foreground">{row.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Pill className="tabular-nums" label="LRN">
                  {row.lrn || "—"}
                </Pill>
                <Pill label="Grade level">{row.gradeLevel || "—"}</Pill>
                <Pill tone="amber" label="Section">
                  {row.section || "No section"}
                </Pill>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone={riskTone(row.riskLevel)} label="Risk level">
                {row.riskLevel} risk
              </Pill>
              <Pill
                tone={intervention ? outcomeTone(intervention.outcomeStatus) : "neutral"}
                label="Intervention state"
              >
                {intervention ? outcomeLabel(intervention.outcomeStatus) : "No plan yet"}
              </Pill>
              {intervention ? (
                <Pill tone={approvalTone(intervention.approvalStatus)} label="Approval">
                  {formatStatus(intervention.approvalStatus)}
                </Pill>
              ) : null}
            </div>
          </div>

          {/* Risk factors */}
          <div className="flex flex-wrap items-center gap-1.5 px-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Risk factors
            </span>
            {activeFactors.length > 0 ? (
              activeFactors.map((factor) => (
                <Pill key={factor.key} tone={factor.tone} label={`${factor.label} risk factor`}>
                  {factor.label}
                </Pill>
              ))
            ) : (
              <Pill tone="neutral" label="Risk factors">
                None active
              </Pill>
            )}
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
              {row.riskCount} flag{row.riskCount === 1 ? "" : "s"}
            </span>
          </div>

          {intervention ? (
            <div className="grid gap-3 lg:grid-cols-5">
              <SectionCard
                icon={ClipboardList}
                title="Follow-up plan"
                className="lg:col-span-3"
                aside={
                  intervention.priority ? (
                    <Pill
                      tone={
                        intervention.priority === "high"
                          ? "red"
                          : intervention.priority === "low"
                            ? "neutral"
                            : "blue"
                      }
                      label="Priority"
                    >
                      {formatStatus(intervention.priority)} priority
                    </Pill>
                  ) : null
                }
              >
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Fact label="Recommended action" className="sm:col-span-2">
                    {intervention.recommendedAction}
                  </Fact>
                  <Fact label="Assignee">{intervention.assignee ?? "Not assigned yet"}</Fact>
                  <Fact label="Assigned">{formatDate(intervention.assignedAt)}</Fact>
                </dl>
                {intervention.intakeNotes ? (
                  <NoteBlock label="Intake notes">{intervention.intakeNotes}</NoteBlock>
                ) : null}
                {intervention.outcomeNotes ? (
                  <NoteBlock label="Outcome notes">{intervention.outcomeNotes}</NoteBlock>
                ) : null}
              </SectionCard>

              <SectionCard
                icon={CalendarDays}
                title="Counseling sessions"
                className="lg:col-span-2"
                aside={
                  intervention.sessions.length > 0 ? (
                    <div className="flex items-center gap-1">
                      {doneCount > 0 ? <Pill tone="green">{doneCount} done</Pill> : null}
                      {scheduledCount > 0 ? (
                        <Pill tone="blue">{scheduledCount} booked</Pill>
                      ) : null}
                    </div>
                  ) : null
                }
              >
                {intervention.sessions.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {intervention.sessions.map((session, index) => (
                      <SessionItem key={session.id} session={session} index={index} />
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border px-3 py-6 text-center">
                    <CalendarClock size={18} className="text-muted-foreground" aria-hidden />
                    <p className="m-0 mt-1 text-xs font-semibold text-foreground">
                      No sessions booked yet
                    </p>
                    <p className="m-0 text-[11px] text-muted-foreground">
                      The guidance desk books the first counseling session.
                    </p>
                  </div>
                )}
              </SectionCard>
            </div>
          ) : (
            <SectionCard icon={ClipboardList} title="Follow-up plan">
              <div className="flex items-start gap-2.5 rounded-md border border-dashed border-border bg-muted/20 p-3">
                <HeartHandshake
                  size={16}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="m-0 text-xs font-semibold text-foreground">No plan yet</p>
                  <p className="m-0 mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Guidance has flagged or been notified about this learner but has not opened
                    an intervention for the current term yet.
                  </p>
                </div>
              </div>
            </SectionCard>
          )}
        </div>
      ) : null}
    </KanbanOverlay>
  );
}
