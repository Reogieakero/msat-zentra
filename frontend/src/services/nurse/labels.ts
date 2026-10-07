// Pure derivation for the nurse desk: status vocabulary, scope filter,
// row builders, and the overview aggregation. No API calls, no hooks.
import { formatGrade, formatSection } from "@/lib/utils";
import type {
  NurseBreakdownRow,
  NurseKpis,
  NurseOverviewData,
  NurseQueueRow,
  NurseSessionItem,
  NurseTrendPoint,
  RawReferral,
  RawSession,
} from "./nurse.types";

export const NURSE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  in_progress: "In progress",
  follow_up: "Follow-up",
  info_requested: "Needs info",
  escalated: "Escalated",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const DAY_MS = 86_400_000;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function referredTimeMs(value: string | null | undefined): number {
  const d = parseDate(value);
  return d ? d.getTime() : Number.POSITIVE_INFINITY;
}

function titleCase(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Derive the action-based status key and label from referral fields —
 *  the same vocabulary the Needs-review table uses, so charts and the
 *  table always agree. */
export function deriveActionStatus(
  type: string,
  status: string,
  sessions: { status?: string | null }[],
): { key: string; label: string } {
  const hasScheduled = sessions.some((s) => s.status === "scheduled");
  const hasCompleted = sessions.some((s) => s.status === "completed");
  const isEndorsedCase = type === "ADM" && status === "in_progress";

  if (isEndorsedCase) return { key: "endorsed", label: "Endorsed" };
  if (status === "dismissed") return { key: "rejected", label: "Rejected" };
  if (status === "resolved") return { key: "done", label: "Done" };
  if (status === "follow_up") return { key: "followup", label: "Follow-up" };
  if (hasScheduled) return { key: "booked", label: "Booked session" };
  if (hasCompleted) return { key: "done_session", label: "Done session" };
  if (status === "pending") return { key: "needs_review", label: "Needs review" };
  if (status === "escalated") return { key: "escalated", label: "Escalated" };
  return { key: status, label: NURSE_STATUS_LABELS[status] ?? titleCase(status) };
}

/**
 * Menu-aligned chart bucket for one referral — the same priority the
 * timeline watermarks use, collapsed onto the ADM / Clinic action-menu
 * vocabulary so the overview charts ("Caseload by status", "Clinic
 * matters caseload", "ADM cases caseload") only ever show labels that
 * exist in those menus. Every status lands in exactly one bucket:
 * dismissed → Rejected, resolved → Done, endorsed ADM → Endorsed,
 * follow-up → Follow-up, scheduled session → Booked session, finished
 * session → Done, anything awaiting action (pending, escalated,
 * info-requested, bare in-progress) → Needs review.
 */
export function chartBucketFor(
  type: string,
  status: string,
  sessions: { status?: string | null }[],
): { key: string; label: string } {
  const list = sessions ?? [];
  const hasScheduled = list.some((s) => s.status === "scheduled");
  const hasCompleted = list.some((s) => s.status === "completed");

  if (type === "ADM" && status === "in_progress") return { key: "endorsed", label: "Endorsed" };
  if (status === "dismissed") return { key: "rejected", label: "Rejected" };
  if (status === "resolved") return { key: "done", label: "Done" };
  if (status === "follow_up") return { key: "followup", label: "Follow-up" };
  if (hasScheduled) return { key: "booked", label: "Booked session" };
  if (hasCompleted) return { key: "done", label: "Done" };
  if (list.length > 0) return { key: "booked", label: "Booked session" };
  return { key: "needs_review", label: "Needs review" };
}

// A referral belongs on the nurse's desk when:
//  - it was routed to the nurse role, or
//  - another role escalated it specifically to the nurse, or
//  - it is an ADM-track referral the adviser sent to the nurse as the
//    consultation reviewer (guidance is locked out of these server-side,
//    so the nurse is their only owner at the consultation stage).
export function isNurseScope(r: RawReferral): boolean {
  if (r.referredToRole === "nurse") return true;
  if (r.status === "escalated" && r.escalatedTo === "nurse") return true;
  if (r.referredToRole === "adm_coordinator" && r.consultReviewer === "nurse") return true;
  return false;
}

function identityOf(r: RawReferral): { student: string; lrn: string; section: string; grade: string } {
  if (r.roster) {
    return {
      student: r.roster.fullName?.trim() || (r.roster.lrn ? `Student ${r.roster.lrn}` : "Unknown student"),
      lrn: r.roster.lrn ?? "—",
      section: formatSection(r.roster.section?.name) || "—",
      grade: formatGrade(r.roster.gradeLevel) || "—",
    };
  }
  if (r.student) {
    return {
      student: `Student ${r.student.lrn}`,
      lrn: r.student.lrn,
      section: formatSection(r.student.section?.name) || "—",
      grade: formatGrade(r.student.gradeLevel) || "—",
    };
  }
  return { student: "Unknown student", lrn: "—", section: "—", grade: "—" };
}

export function toSessionItem(s: RawSession): NurseSessionItem {
  return {
    id: s.id,
    sessionType: s.sessionType ?? "individual",
    scheduledAt: s.scheduledAt ?? "",
    date: parseDate(s.scheduledAt)?.toISOString().slice(0, 10) ?? "",
    venue: s.venue ?? "",
    status: s.status ?? "scheduled",
    sessionNotes: s.sessionNotes ?? "",
    outcome: s.outcome ?? "",
    cancelReason: s.cancelReason ?? "",
    cancelledByRole: s.cancelledByRole ?? null,
    createdAt: s.createdAt ?? s.scheduledAt ?? "",
    completedAt: parseDate(s.completedAt)?.toISOString().slice(0, 10) ?? "",
    attachments: (s.attachments ?? []).map((a) => ({
      id: a.id,
      fileUrl: a.fileUrl,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      uploadedAt: a.uploadedAt,
    })),
  };
}

export function toQueueRow(r: RawReferral): NurseQueueRow {
  const identity = identityOf(r);
  // Waiting counts from when the case was referred, not when the incident
  // was observed — a case filed weeks ago but referred today waits 0 days.
  const referred = parseDate(r.referredAt) ?? parseDate(r.anecdotalRecord?.observationDatetime);
  const anec = r.anecdotalRecord ?? null;
  const observed = parseDate(anec?.observationDatetime);
  const sessions = (r.counselingSessions ?? []).map(toSessionItem);
  return {
    id: r.id,
    ...identity,
    type: r.consultReviewer ? "ADM" : "Clinic",
    consultReviewer: r.consultReviewer ?? null,
    referralReady: r.referralFormReady === true,
    category: anec?.category ? titleCase(anec.category) : "—",
    reason: r.reason?.trim() ? r.reason.trim().slice(0, 140) : "No reason recorded",
    status: r.status ?? "pending",
    date: referred ? referred.toISOString().slice(0, 10) : "—",
    waitingDays: referred ? Math.max(0, wholeDaysBetween(referred, startOfToday())) : null,
    referredAt: r.referredAt ?? r.anecdotalRecord?.observationDatetime ?? "",
    followUpDate: parseDate(r.followUpDate)?.toISOString().slice(0, 10) ?? "",
    intakeNotes: r.intakeNotes?.trim() ?? "",
    notes: r.notes?.trim() ?? "",
    escalationReason: r.escalationReason?.trim() ?? "",
    sessions,
    completedSessions: sessions.filter((s) => s.status === "completed").length,
    lastActionAt: r.lastActionAt ?? "",
    lastActionType: r.lastActionType ?? "",
    dismissedByRole: r.dismissedByRole ?? "",
    anecdotalId: anec?.id ?? null,
    anecdotal: anec
      ? {
          observedAt: observed ? observed.toISOString().slice(0, 10) : "—",
          category: anec.category ? titleCase(anec.category) : "—",
          location: anec.descriptionOfLocation?.trim() || "—",
          incident: anec.descriptionOfIncident?.trim() || "—",
          classPerformance: anec.classPerformance?.trim() || "—",
          attendanceSummary: anec.attendanceSummary?.trim() || "—",
          notes: anec.notesRecommendationsActions?.trim() || "—",
        }
      : null,
  };
}

// Pure aggregation over the referrals list. Kept side-effect free so the
// numbers on this page always derive from one fetch, one filter, one pass.
export function buildNurseOverview(referrals: RawReferral[]): NurseOverviewData {
  const scoped = referrals.filter(isNurseScope);

  const kpis: NurseKpis = {
    needsReview: scoped.filter((r) => r.status === "pending").length,
    bookedSession: scoped.filter((r) =>
      (r.counselingSessions ?? []).some((s) => s.status === "scheduled"),
    ).length,
    endorsedToAdm: scoped.filter(
      (r) => r.consultReviewer && r.status === "in_progress",
    ).length,
    followUp: scoped.filter((r) => r.status === "follow_up").length,
    doneSession: scoped.filter((r) =>
      (r.counselingSessions ?? []).some((s) => s.status === "completed"),
    ).length,
    total: scoped.length,
  };

  const needsReview = scoped
    .filter((r) => r.status === "pending" || (r.status === "escalated" && r.escalatedTo === "nurse"))
    .map(toQueueRow)
    .sort((a, b) => referredTimeMs(a.referredAt) - referredTimeMs(b.referredAt));

  const actionStatusBreakdown = (referrals: RawReferral[]): NurseBreakdownRow[] => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const r of referrals) {
      const type = r.consultReviewer ? "ADM" : "Clinic";
      const sessions = r.counselingSessions ?? [];
      const action = chartBucketFor(type, r.status ?? "pending", sessions);
      const existing = counts.get(action.key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(action.key, { label: action.label, count: 1 });
      }
    }
    return [...counts.entries()]
      .map(([key, { label, count }]) => ({ key, label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const statusBreakdown = actionStatusBreakdown(scoped);
  const clinicStatusBreakdown = actionStatusBreakdown(scoped.filter((r) => !r.consultReviewer));
  const admStatusBreakdown = actionStatusBreakdown(scoped.filter((r) => r.consultReviewer));

  // Trailing 14-day case-load series (referred time → now), split by
  // type — drives the overview "Case load" line graph. Rows without a
  // parseable referred time land outside the window and are skipped.
  const nowMs = Date.now();
  const dailyTrend: NurseTrendPoint[] = [];
  const trendIndex = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(nowMs - i * DAY_MS).toISOString().slice(0, 10);
    if (trendIndex.has(date)) continue;
    trendIndex.set(date, dailyTrend.length);
    dailyTrend.push({ date, adm: 0, clinic: 0 });
  }
  for (const r of scoped) {
    const at = parseDate(r.referredAt);
    if (!at) continue;
    const idx = trendIndex.get(at.toISOString().slice(0, 10));
    if (idx === undefined) continue;
    if (r.consultReviewer) dailyTrend[idx].adm += 1;
    else dailyTrend[idx].clinic += 1;
  }

  return { kpis, needsReview, statusBreakdown, clinicStatusBreakdown, admStatusBreakdown, dailyTrend };
}
