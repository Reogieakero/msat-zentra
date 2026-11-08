"use client";

import type { KeyboardEvent } from "react";
import { Clock } from "lucide-react";
import { formatElapsedShort, msSinceDate } from "@/lib/clock";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { Pill, type PillTone } from "@/components/ui/pill";
import { formatStatus } from "@/lib/labels/text";
import { riskTone } from "@/lib/labels/status-tone";
import { sessionTypeLabel } from "@/lib/labels/sessions";
import type {
  AdvisoryInterventionRow,
  AdvisoryInterventionSession,
} from "@/services/teacher/interventions.service";
import styles from "./interventions.module.css";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Active risk factors shown on the card — same labels/tones as the detail overlay. */
const FACTORS = [
  { key: "academic", label: "Academic", tone: "amber" },
  { key: "attendance", label: "Attendance", tone: "sky" },
  { key: "behavioral", label: "Behavioral", tone: "rose" },
] as const;

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? dateFmt.format(date) : "—";
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Next booked session (falling back to the most recent one). */
export function focusSession(
  sessions: AdvisoryInterventionSession[],
): AdvisoryInterventionSession | null {
  if (sessions.length === 0) return null;
  const now = Date.now();
  return (
    sessions.find(
      (session) =>
        session.status === "scheduled" &&
        new Date(session.scheduledAt).getTime() >= now,
    ) ??
    sessions[sessions.length - 1] ??
    null
  );
}

/**
 * Guidance-desk pipeline label, read-only. Same vocabulary as the guidance
 * board so an adviser sees the exact state the counselling desk sees.
 */
export function advisoryPipelineStatus(row: AdvisoryInterventionRow): {
  label: string;
  tone: PillTone;
} {
  const intervention = row.intervention;
  const doneCount =
    intervention?.sessions.filter((session) => session.status === "completed").length ?? 0;
  const scheduledCount =
    intervention?.sessions.filter((session) => session.status === "scheduled").length ?? 0;

  if (!intervention) return { label: "No plan yet", tone: "neutral" };
  if (intervention.outcomeStatus === "resolved") return { label: "Done", tone: "green" };
  if (intervention.outcomeStatus === "unresolved")
    return { label: "Discontinued", tone: "neutral" };
  if (row.riskLevel === "Low") return { label: "No longer at risk", tone: "neutral" };
  if (intervention.sessions.length === 0)
    return { label: "No action yet", tone: "neutral" };
  if (scheduledCount > 0 && doneCount > 0)
    return { label: "Follow-up session", tone: "blue" };
  if (scheduledCount > 0) return { label: "Booked session", tone: "blue" };
  if (doneCount > 0) return { label: "Session done", tone: "green" };
  return { label: "No action yet", tone: "neutral" };
}

export function InterventionRowCard({
  row,
  index = 0,
  now,
  onOpen,
}: {
  row: AdvisoryInterventionRow;
  index?: number;
  now: number;
  onOpen: (row: AdvisoryInterventionRow) => void;
}) {
  const status = advisoryPipelineStatus(row);
  const activeFactors = FACTORS.filter((factor) => row.factors[factor.key]);
  const doneCount =
    row.intervention?.sessions.filter((session) => session.status === "completed").length ?? 0;
  const detectedMs = row.detectedAt ? msSinceDate(row.detectedAt, now) : null;
  const detectedElapsed =
    detectedMs === null
      ? "—"
      : detectedMs < 60_000
        ? "just now"
        : `${formatElapsedShort(detectedMs)} ago`;

  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(row);
    }
  };

  return (
    <li
      style={{ animationDelay: `${450 + Math.min(index, 11) * 140}ms` }}
      className={styles.caseRow}
      onClick={() => onOpen(row)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`${row.name}'s intervention case`}
    >
      <div className={styles.caseCardHead}>
        <StudentMascot
          name={row.name}
          seed={row.lrn}
          character={row.mascot ?? undefined}
          size={36}
        />
        <div className={styles.caseCardId}>
          <p className={styles.caseCardName}>{row.name}</p>
          <div className={styles.caseCardMeta}>
            <Pill label="LRN" className="tabular-nums">
              {row.lrn || "—"}
            </Pill>
            <Pill
              tone="amber"
              aria-label={`Section ${row.section}`}
              label={row.gradeLevel || "Grade level"}
            >
              {row.section || "—"}
            </Pill>
          </div>
        </div>
        <Pill tone={riskTone(row.riskLevel)} label="Risk level">
          {row.riskLevel}
        </Pill>
      </div>

      <div className={styles.caseCardPills}>
        {activeFactors.length > 0 ? (
          activeFactors.map((factor) => (
            <Pill key={factor.key} tone={factor.tone} label={`${factor.label} risk factor`}>
              {factor.label}
            </Pill>
          ))
        ) : (
          <Pill tone="neutral" label="Risk factor">
            No active factor
          </Pill>
        )}
        <Pill tone={status.tone} label="Status">
          {status.label}
        </Pill>
        {doneCount > 0 && row.intervention?.outcomeStatus !== "resolved" ? (
          <Pill label="Sessions completed">
            {doneCount} session{doneCount === 1 ? "" : "s"} done
          </Pill>
        ) : null}
      </div>

      <div className={styles.caseCardFoot}>
        <Pill label="Detected at" className="tabular-nums">
          <Clock size={11} aria-hidden />
          {detectedElapsed}
        </Pill>
      </div>
    </li>
  );
}

export function approvalTone(status: string) {
  if (status === "approved") return "green" as const;
  if (status === "rejected") return "red" as const;
  if (status === "modified") return "blue" as const;
  return "amber" as const;
}

export function sessionStatusTone(status: string) {
  if (status === "completed") return "green" as const;
  if (status === "cancelled") return "red" as const;
  return "blue" as const;
}

export { formatStatus, formatDateTime, sessionTypeLabel };
