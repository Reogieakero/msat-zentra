"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/ui/FolderCard";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type {
  CounselingSessionItem,
  CounselingSessionType,
  GuidanceReferralItem,
  GuidanceReferralStatus,
} from "./guidance-referrals-data";
import {
  acceptReferral,
  updateReferralStatus,
  escalateReferral,
  reassignReferral,
  addReferralNote,
  flagReferralFollowUp,
  dismissReferral,
  referToSpecialist,
  initiateAdm,
  scheduleSession,
  completeSession,
  rescheduleSession,
  cancelSession,
} from "./guidance-referrals-data";
import {
  GuidanceReferralsFilters,
  type StatusFilter,
} from "./guidance-referrals-filters";
import {
  SessionDatePicker,
  SessionTimePicker,
} from "./session-datetime-picker";
import { FormDropdown } from "./form-dropdown";
import styles from "./guidance-referrals-table.module.css";

function formatStatus(value: string): string {
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* "2026-09-12" -> "Sep 12, 2026": long dates confuse non-technical readers. */
function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = months[Number(match[2]) - 1] ?? match[2];
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

/* Same relative-time tag the folder UI shows under each file. */
function timeAgo(iso: string): string {
  const then = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(then) || then < Date.UTC(2000, 0, 1)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/* Plain words for each case status — "Pending" means little to non-staff. */
function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Needs action";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "escalated":
      return "Sent higher up";
    case "follow_up":
      return "Follow-up";
    case "dismissed":
      return "Closed";
    case "info_requested":
      return "Needs more info";
    default:
      return formatStatus(status);
  }
}

/* One plain line telling the reader what the status means for them. */
function statusHelp(status: string): string {
  switch (status) {
    case "pending":
      return "Waiting for you to accept this case.";
    case "in_progress":
      return "You accepted this — it is being handled.";
    case "resolved":
      return "Done. Nothing left to do.";
    case "escalated":
      return "This was sent to a higher office.";
    case "follow_up":
      return "Check back on the follow-up date below.";
    case "dismissed":
      return "Closed without further action.";
    case "info_requested":
      return "Waiting for more information.";
    default:
      return "";
  }
}

function roleLabel(value: string): string {
  switch (value) {
    case "principal":
      return "Principal";
    case "nurse":
      return "Nurse";
    case "adm_coordinator":
      return "ADM coordinator";
    case "guidance_counselor":
      return "Guidance";
    default:
      return formatStatus(value);
  }
}

/* Friendly names for the four session kinds. */
export function sessionTypeLabel(value: string): string {
  switch (value) {
    case "individual":
      return "One-on-one";
    case "parent_conference":
      return "Parent conference";
    case "group":
      return "Group session";
    case "home_visit":
      return "Home visit";
    default:
      return formatStatus(value);
  }
}

/* "2026-09-20T06:30:00.000Z" -> "2:30 PM" (reader's timezone). */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* "2026-09-20T06:30:00.000Z" -> "Sep 20, 2026 · 2:30 PM" (reader's timezone). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

export function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

/* Shared by the accept + schedule dialogs — and the interventions page. */
export const SESSION_KIND_OPTIONS = [
  { value: "individual", label: "One-on-one" },
  { value: "parent_conference", label: "Parent conference" },
  { value: "group", label: "Group session" },
  { value: "home_visit", label: "Home visit" },
];

export function combineDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* Spinner shown inside a button while its action is running. The button
   text already flips ("Saving…"), so this is purely visual. */
function Busy({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return <Loader2 className={styles.spin} aria-hidden="true" />;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function statusVariant(
  status: string
): "warning" | "destructive" | "secondary" | "outline" {
  if (status === "pending") return "warning";
  if (status === "escalated") return "destructive";
  if (status === "resolved" || status === "dismissed") return "secondary";
  return "outline";
}

interface ActionDialogs {
  escalate: boolean;
  reassign: boolean;
  note: boolean;
  followUp: boolean;
  dismiss: boolean;
  specialist: boolean;
  adm: boolean;
  accept: boolean;
  schedule: boolean;
  finish: boolean;
  move: boolean;
  cancelSess: boolean;
  resolve: boolean;
}

interface ActionFormState {
  escalationReason: string;
  escalatedTo: string;
  noteText: string;
  followUpDate: string;
  dismissReason: string;
  specialistRole: string;
  specialistReason: string;
  admReason: string;
  priority: string;
  intakeNotes: string;
  sessDate: string;
  sessTime: string;
  sessType: string;
  sessVenue: string;
  doneNotes: string;
  doneOutcome: string;
  cancelReasonInput: string;
  resolveSummary: string;
}

const INITIAL_FORM: ActionFormState = {
  escalationReason: "",
  escalatedTo: "",
  noteText: "",
  followUpDate: "",
  dismissReason: "",
  specialistRole: "",
  specialistReason: "",
  admReason: "",
  priority: "normal",
  intakeNotes: "",
  sessDate: "",
  sessTime: "",
  sessType: "individual",
  sessVenue: "",
  doneNotes: "",
  doneOutcome: "",
  cancelReasonInput: "",
  resolveSummary: "",
};

export function GuidanceReferralsTable({
  referrals,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  query,
  onQueryChange,
  status,
  onStatusChange,
  onRetry,
  isRetrying,
  isNavigating,
}: GuidanceReferralsTableProps) {
  const queryClient = useQueryClient();
  const [dialogs, setDialogs] = useState<ActionDialogs>({
    escalate: false,
    reassign: false,
    note: false,
    followUp: false,
    dismiss: false,
    specialist: false,
    adm: false,
    accept: false,
    schedule: false,
    finish: false,
    move: false,
    cancelSess: false,
    resolve: false,
  });
  const [form, setForm] = useState<ActionFormState>(INITIAL_FORM);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  /* Anecdotal record open in the official-form overlay (same as folder UI). */
  const [previewId, setPreviewId] = useState<string | null>(null);
  /* Student whose finished case shows the privacy notice instead. */
  const [privacyFor, setPrivacyFor] = useState<string | null>(null);

  const openDialog = (id: string, dialog: keyof ActionDialogs) => {
    setActiveId(id);
    setActiveSessionId(null);
    setForm(INITIAL_FORM);
    setDialogs((prev) => ({ ...prev, [dialog]: true }));
  };

  const openSessionDialog = (
    referralId: string,
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => {
    setActiveId(referralId);
    setActiveSessionId(session.id);
    setForm({
      ...INITIAL_FORM,
      // "Move" starts from the current slot; "finish" leaves the follow-up
      // date empty so booking the next session stays opt-in.
      sessDate: dialog === "move" ? toDateInputValue(session.scheduledAt) : "",
      sessTime: dialog === "move" ? toTimeInputValue(session.scheduledAt) : "",
      // Follow-up defaults to the same kind of session.
      sessType: dialog === "finish" ? session.sessionType : INITIAL_FORM.sessType,
    });
    setDialogs((prev) => ({ ...prev, [dialog]: true }));
  };

  const closeDialog = (dialog: keyof ActionDialogs) => {
    setDialogs((prev) => ({ ...prev, [dialog]: false }));
    if (Object.values(dialogs).every((v) => !v)) setActiveId(null);
  };

  const mutation = useMutation({
    mutationFn: ({
      id,
      next,
      summary,
    }: {
      id: string;
      next: GuidanceReferralStatus;
      summary?: string;
    }) => updateReferralStatus(id, next, summary),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-alerts"] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      payload,
    }: {
      id: string;
      action: string;
      payload: unknown;
    }) => {
      switch (action) {
        case "escalate":
          return escalateReferral(
            id,
            (payload as { escalationReason: string; escalatedTo: string })
              .escalationReason,
            (payload as { escalatedTo: string }).escalatedTo as "principal" | "nurse" | "adm_coordinator"
          );
        case "reassign":
          return reassignReferral(
            id,
            (payload as { referredToRole: string }).referredToRole as "nurse" | "guidance_counselor" | "adm_coordinator" | "principal"
          );
        case "note":
          return addReferralNote(id, (payload as { notes: string }).notes);
        case "followUp":
          return flagReferralFollowUp(
            id,
            (payload as { followUpDate: string }).followUpDate
          );
        case "dismiss":
          return dismissReferral(
            id,
            (payload as { reason: string }).reason
          );
        case "specialist":
          return referToSpecialist(
            id,
            (payload as { referredToRole: string }).referredToRole as "nurse" | "adm_coordinator" | "principal",
            (payload as { reason: string }).reason
          );
        case "adm":
          return initiateAdm(id, (payload as { reason: string }).reason);
        case "accept": {
          const p = payload as {
            priority: "low" | "normal" | "high";
            intakeNotes?: string;
            firstSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return acceptReferral(id, p);
        }
        case "schedule": {
          const p = payload as {
            scheduledAt: string;
            sessionType: CounselingSessionType;
            venue?: string;
          };
          return scheduleSession(id, p);
        }
        case "finish": {
          const p = payload as {
            sessionId: string;
            sessionNotes: string;
            outcome?: string;
            followUpSession?: {
              scheduledAt: string;
              sessionType: CounselingSessionType;
              venue?: string;
            };
          };
          return completeSession(id, p.sessionId, {
            sessionNotes: p.sessionNotes,
            outcome: p.outcome,
            followUpSession: p.followUpSession,
          });
        }
        case "move": {
          const p = payload as { sessionId: string; scheduledAt: string };
          return rescheduleSession(id, p.sessionId, p.scheduledAt);
        }
        case "cancelSess": {
          const p = payload as { sessionId: string; cancelReason?: string };
          return cancelSession(id, p.sessionId, p.cancelReason);
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidance-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-overview"] });
      queryClient.invalidateQueries({ queryKey: ["guidance-alerts"] });
    },
  });

  const handleAction = (action: string, payload: unknown) => {
    if (!activeId) return;
    actionMutation.mutate({ id: activeId, action, payload });
    setDialogs({
      escalate: false,
      reassign: false,
      note: false,
      followUp: false,
      dismiss: false,
      specialist: false,
      adm: false,
      accept: false,
      schedule: false,
      finish: false,
      move: false,
      cancelSess: false,
      resolve: false,
    });
    setActiveId(null);
    setActiveSessionId(null);
  };

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const updatingId =
    mutation.isPending && mutation.variables ? mutation.variables.id : null;
  const isActionPending = actionMutation.isPending;

  const openCases = referrals.filter(
    (r) => r.status !== "resolved" && r.status !== "dismissed"
  ).length;
  const hasActiveFilters = query.trim() !== "" || status !== "";
  const activeRow = referrals.find((r) => r.id === activeId) ?? null;
  const activeSession =
    activeRow?.sessions.find((s) => s.id === activeSessionId) ?? null;

  return (
    <div className={styles.feed}>
      <h1 className={styles.srOnly}>Cases sent to guidance</h1>
      <div className={styles.toolbar}>
        <p className={styles.count} aria-live="polite">
          {total === 0
            ? "No cases"
            : `${total} case${total === 1 ? "" : "s"} sent to you${
                openCases > 0 ? ` · ${openCases} still need${
                  openCases === 1 ? "s" : ""
                } action` : ""
              }`}
        </p>
        <GuidanceReferralsFilters
          query={query}
          onQueryChange={onQueryChange}
          status={status}
          onStatusChange={onStatusChange}
        />
      </div>

      {mutation.isError && (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            Sorry — that change did not go through. Please try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRetrying}
            onClick={() => onRetry()}
          >
            <Busy busy={isRetrying} />
            {isRetrying ? "Loading…" : "Try again"}
          </Button>
        </div>
      )}
      {actionMutation.isError && (
        <div className={styles.errorBlock} role="alert">
          <p className={styles.errorText}>
            Sorry — that action did not go through. Please try again.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={isRetrying}
            onClick={() => onRetry()}
          >
            <Busy busy={isRetrying} />
            {isRetrying ? "Loading…" : "Try again"}
          </Button>
        </div>
      )}

      {referrals.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {hasActiveFilters
              ? "No cases match your search"
              : "You're all caught up"}
          </p>
          <p className={styles.emptyHint}>
            {hasActiveFilters
              ? "Try a different name or keyword, or clear the filter to see every case."
              : "New cases sent to you by advisers will appear here."}
          </p>
        </div>
      ) : (
        <ol className={styles.timeline}>
          {referrals.map((row) => {
            const updating = updatingId === row.id;
            const isPending = row.status === "pending";
            const isDismissed = row.status === "dismissed";
            const isClosed =
              row.status === "resolved" || isDismissed;
            return (
              <li key={row.id} className={styles.entry}>
                <span className={styles.dot} aria-hidden="true" />
                {/* Left rail — when it arrived and what state it is in */}
                <div className={styles.rail}>
                  <p className={styles.railDate}>
                    <time dateTime={row.date}>{formatDate(row.date)}</time>
                  </p>
                  <div className={styles.railBadges}>
                    <Badge variant={statusVariant(row.status)}>
                      {statusLabel(row.status)}
                    </Badge>
                    <Badge variant="outline">
                      {formatStatus(row.category)}
                    </Badge>
                    {row.priority === "high" ? (
                      <Badge variant="destructive">High priority</Badge>
                    ) : null}
                    {row.priority === "low" ? (
                      <Badge variant="outline">Low priority</Badge>
                    ) : null}
                  </div>
                  {statusHelp(row.status) ? (
                    <p className={styles.statusHelp}>
                      {statusHelp(row.status)}
                    </p>
                  ) : null}
                  <p className={styles.railMeta}>Sent by {row.referredBy}</p>
                  <p className={styles.railMeta}>
                    Observed by {row.observer || "not recorded"}
                  </p>
                </div>

                {/* Center — the report itself: reason, what happened, details */}
                <div className={styles.body}>
                  <h2 className={styles.reason}>{row.reason}</h2>

                  {row.anecdotalExcerpt || row.anecdotalId ? (
                    <div className={styles.block}>
                      <p className={styles.blockLabel}>What was observed</p>
                      {row.anecdotalExcerpt ? (
                        <p className={styles.blockText}>
                          {row.anecdotalExcerpt}
                        </p>
                      ) : null}
                      {row.anecdotalId ? (
                        <button
                          type="button"
                          className={styles.folderBtn}
                          onClick={() =>
                            isClosed
                              ? setPrivacyFor(row.student)
                              : setPreviewId(row.anecdotalId)
                          }
                          aria-label={
                            isClosed
                              ? `Report for ${row.student} is kept private because the case is finished`
                              : `Open the official anecdotal report for ${row.student}`
                          }
                        >
                          <FolderCard
                            label="Anecdotal report"
                            sublabel={`${formatStatus(row.category)} · ${formatDate(row.date)}`}
                            files={[
                              {
                                name: `OCForm-01_${row.date}`,
                                tag: `${formatStatus(row.category)} • ${timeAgo(row.date)}`,
                                icon: "doc",
                              },
                            ]}
                          />
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {row.location || row.recommendations || row.confidentiality ? (
                    <dl className={styles.metaGrid}>
                      {row.location ? (
                        <div className={styles.metaItem}>
                          <dt>Where it happened</dt>
                          <dd>{row.location}</dd>
                        </div>
                      ) : null}
                      {row.recommendations ? (
                        <div className={styles.metaItem}>
                          <dt>Suggested next steps</dt>
                          <dd>{row.recommendations}</dd>
                        </div>
                      ) : null}
                      {row.confidentiality ? (
                        <div className={styles.metaItem}>
                          <dt>Privacy level</dt>
                          <dd>{formatStatus(row.confidentiality)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}

                  {row.intakeNotes ? (
                    <p className={styles.calloutMuted}>
                      <span className={styles.calloutPrefix}>First impressions: </span>
                      {row.intakeNotes}
                    </p>
                  ) : null}

                  {/* Counseling plan — the real work on an accepted case */}
                  {isPending ? (
                    <p className={styles.planHint}>
                      Accept this case to record your first impressions and
                      schedule counseling sessions.
                    </p>
                  ) : (
                    <div className={styles.plan}>
                      <div className={styles.planHead}>
                        <p className={styles.blockLabel}>Counseling plan</p>
                        {!isClosed ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isActionPending}
                            onClick={() => openDialog(row.id, "schedule")}
                          >
                            Schedule a session
                          </Button>
                        ) : null}
                      </div>
                      {isClosed ? (
                        <p className={styles.planEmpty}>
                          This case is closed — the sessions below are kept as
                          history and can&apos;t be changed.
                        </p>
                      ) : null}
                      {row.sessions.length === 0 ? (
                        <p className={styles.planEmpty}>
                          No sessions yet — schedule the first talk with{" "}
                          {row.student.split(" ")[0]}.
                        </p>
                      ) : (
                        <ul className={styles.sessionList}>
                          {row.sessions.map((s) => (
                            <li key={s.id} className={styles.session}>
                              <div className={styles.sessionTop}>
                                <Badge
                                  variant={
                                    s.status === "completed"
                                      ? "success"
                                      : s.status === "cancelled"
                                        ? "secondary"
                                        : "default"
                                  }
                                >
                                  {s.status === "completed"
                                    ? "Done"
                                    : s.status === "cancelled"
                                      ? "Cancelled"
                                      : "Upcoming"}
                                </Badge>
                                <p className={styles.sessionTitle}>
                                  {sessionTypeLabel(s.sessionType)}
                                </p>
                              </div>
                              <ul className={styles.sessionFacts}>
                                <li>
                                  <time dateTime={s.scheduledAt}>
                                    {formatDate(s.date)}
                                  </time>
                                </li>
                                <li>{formatTime(s.scheduledAt)}</li>
                                {s.venue ? <li>{s.venue}</li> : null}
                              </ul>
                              {s.status === "completed" && s.sessionNotes ? (
                                <p className={styles.sessionNotes}>
                                  {s.sessionNotes}
                                </p>
                              ) : null}
                              {s.status === "completed" && s.outcome ? (
                                <p className={styles.sessionOutcome}>
                                  <span className={styles.calloutPrefix}>
                                    Outcome:{" "}
                                  </span>
                                  {s.outcome}
                                </p>
                              ) : null}
                              {s.status === "cancelled" && s.cancelReason ? (
                                <p className={styles.sessionOutcome}>
                                  {s.cancelReason}
                                </p>
                              ) : null}
                              {s.status === "scheduled" && !isClosed && (
                                <div className={styles.sessionActions}>
                                  <Button
                                    type="button"
                                    size="xs"
                                    disabled={isActionPending}
                                    onClick={() =>
                                      openSessionDialog(row.id, s, "finish")
                                    }
                                  >
                                    Mark done
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    disabled={isActionPending}
                                    onClick={() =>
                                      openSessionDialog(row.id, s, "move")
                                    }
                                  >
                                    Move
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    disabled={isActionPending}
                                    onClick={() =>
                                      openSessionDialog(row.id, s, "cancelSess")
                                    }
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {row.followUpDate ? (
                    <p className={styles.callout}>
                      Reminder: check back on{" "}
                      <time dateTime={row.followUpDate}>
                        {formatDate(row.followUpDate)}
                      </time>
                      .
                    </p>
                  ) : null}
                  {row.escalationReason ? (
                    <p className={styles.callout}>
                      Sent up{row.escalatedTo ? ` to ${roleLabel(row.escalatedTo)}` : ""}:{" "}
                      {row.escalationReason}
                    </p>
                  ) : null}
                  {row.notes ? (
                    <p className={styles.calloutMuted}>
                      <span className={styles.calloutPrefix}>Internal note: </span>
                      {row.notes}
                    </p>
                  ) : null}
                  {row.resolutionSummary ? (
                    <p className={styles.calloutMuted}>
                      <span className={styles.calloutPrefix}>How this ended: </span>
                      {row.resolutionSummary}
                    </p>
                  ) : null}

                  <div className={styles.actions}>
                    {isPending && (
                      <Button
                        size="sm"
                        disabled={isActionPending}
                        onClick={() => openDialog(row.id, "accept")}
                      >
                        Accept case
                      </Button>
                    )}
                    {!isClosed && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updating || isActionPending}
                        onClick={() => openDialog(row.id, "resolve")}
                      >
                        Finish & close
                      </Button>
                    )}
                    {!isClosed && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isActionPending}
                            aria-label={`More actions for ${row.student}`}
                          >
                            <MoreHorizontal aria-hidden="true" />
                            More actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={styles.moreMenu}>
                          <DropdownMenuItem
                            onSelect={() => openDialog(row.id, "escalate")}
                          >
                            Send to a higher office…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => openDialog(row.id, "reassign")}
                          >
                            Pass to someone else…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => openDialog(row.id, "note")}
                          >
                            Add internal note…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => openDialog(row.id, "followUp")}
                          >
                            Remind me to check back…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => openDialog(row.id, "specialist")}
                          >
                            Ask a specialist for help…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => openDialog(row.id, "adm")}
                          >
                            Start ADM process…
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => openDialog(row.id, "dismiss")}
                          >
                            Close without action…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button size="sm" variant="ghost" asChild>
                      <Link href="/guidance/interventions">
                        See interventions
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Right — who this case is about */}
                <aside
                  className={styles.student}
                  aria-label={`About the student: ${row.student}`}
                >
                  <p className={styles.studentCaption}>Student</p>
                  <div className={styles.studentRow}>
                    <Avatar className={styles.avatar} aria-hidden="true">
                      <AvatarFallback>{initials(row.student)}</AvatarFallback>
                    </Avatar>
                    <div className={styles.studentText}>
                      <p className={styles.studentName}>{row.student}</p>
                      {row.lrn ? (
                        <p className={styles.studentSub}>
                          ID <span className={styles.lrn}>{row.lrn}</span>
                        </p>
                      ) : null}
                      <p className={styles.studentSub}>
                        {row.section}
                        {row.grade ? ` · ${row.grade}` : ""}
                      </p>
                    </div>
                  </div>
                </aside>
              </li>
            );
          })}
        </ol>
      )}

      {/* Pager */}
      <nav className={styles.pager} aria-label="Cases pages">
        <p className={styles.range}>
          Showing cases {start}–{end} of {total}
        </p>
        <div className={styles.pagerButtons}>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || isNavigating}
            onClick={() => onPageChange(page - 1)}
            aria-label="Show newer cases"
          >
            ← Newer
          </Button>
          <span className={styles.pageLabel} aria-live="polite">
            {isNavigating ? (
              <span className={styles.loadingLabel}>
                <Busy busy />
                Loading…
              </span>
            ) : (
              `Page ${page} of ${totalPages}`
            )}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages || isNavigating}
            onClick={() => onPageChange(page + 1)}
            aria-label="Show older cases"
          >
            Older →
          </Button>
        </div>
      </nav>

      {/* Escalate Dialog */}
      <Dialog
        open={dialogs.escalate}
        onOpenChange={() => closeDialog("escalate")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to a higher office</DialogTitle>
            <DialogDescription>
              Send this case up when it needs attention beyond guidance.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <div>
              <FormDropdown
                id="escalatedTo"
                label="Send to"
                value={form.escalatedTo}
                onChange={(v) => setForm((f) => ({ ...f, escalatedTo: v }))}
                placeholder="Pick an office"
                options={[
                  { value: "principal", label: "Principal" },
                  { value: "nurse", label: "Nurse" },
                  { value: "adm_coordinator", label: "ADM Coordinator" },
                ]}
              />
            </div>
            <div className={styles.formFull}>
              <Label htmlFor="escalationReason">Why does this need to go higher?</Label>
              <Textarea
                id="escalationReason"
                value={form.escalationReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, escalationReason: e.target.value }))
                }
                placeholder="Explain what is happening and what help is needed…"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("escalate")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isActionPending ||
                !form.escalatedTo ||
                !form.escalationReason
              }
              onClick={() =>
                handleAction("escalate", {
                  escalationReason: form.escalationReason,
                  escalatedTo: form.escalatedTo,
                })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Sending…" : "Send up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog
        open={dialogs.reassign}
        onOpenChange={() => closeDialog("reassign")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pass to someone else</DialogTitle>
            <DialogDescription>
              Hand this case to another office. It will show up in their queue.
            </DialogDescription>
          </DialogHeader>
          <div>
            <FormDropdown
              id="reassignRole"
              label="Pass to"
              value={form.specialistRole}
              onChange={(v) => setForm((f) => ({ ...f, specialistRole: v }))}
              placeholder="Pick an office"
              options={[
                { value: "nurse", label: "Nurse" },
                { value: "guidance_counselor", label: "Guidance Counselor" },
                { value: "adm_coordinator", label: "ADM Coordinator" },
                { value: "principal", label: "Principal" },
              ]}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("reassign")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.specialistRole}
              onClick={() =>
                handleAction("reassign", {
                  referredToRole: form.specialistRole,
                })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Passing…" : "Pass case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={dialogs.note} onOpenChange={() => closeDialog("note")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a private note</DialogTitle>
            <DialogDescription>
              Only guidance staff can see this note.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="noteText">Note</Label>
            <Textarea
              id="noteText"
              value={form.noteText}
              onChange={(e) =>
                setForm((f) => ({ ...f, noteText: e.target.value }))
              }
                placeholder="Write your note here…"
                maxLength={2000}
              />
            </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("note")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.noteText}
              onClick={() => handleAction("note", { notes: form.noteText })}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog
        open={dialogs.followUp}
        onOpenChange={() => closeDialog("followUp")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set a check-back reminder</DialogTitle>
            <DialogDescription>
              Pick a date to come back to this case.
            </DialogDescription>
          </DialogHeader>
          <div>
            <SessionDatePicker
              id="followUpDate"
              label="Check back on"
              value={form.followUpDate}
              onChange={(v) => setForm((f) => ({ ...f, followUpDate: v }))}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("followUp")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.followUpDate}
              onClick={() =>
                handleAction("followUp", { followUpDate: form.followUpDate })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Setting…" : "Set reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss Dialog */}
      <Dialog
        open={dialogs.dismiss}
        onOpenChange={() => closeDialog("dismiss")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close without action</DialogTitle>
            <DialogDescription>
              Close this case. Please say why, so there is a record.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="dismissReason">Why is this being closed?</Label>
              <Textarea
                id="dismissReason"
                value={form.dismissReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dismissReason: e.target.value }))
                }
                placeholder="Explain why no further action is needed…"
                maxLength={500}
              />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("dismiss")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.dismissReason}
              onClick={() =>
                handleAction("dismiss", { reason: form.dismissReason })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Closing…" : "Close case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specialist Dialog */}
      <Dialog
        open={dialogs.specialist}
        onOpenChange={() => closeDialog("specialist")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask a specialist for help</DialogTitle>
            <DialogDescription>
              Send this case to a specialist office.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <div>
              <FormDropdown
                id="specialistRole"
                label="Send to"
                value={form.specialistRole}
                onChange={(v) =>
                  setForm((f) => ({ ...f, specialistRole: v }))
                }
                placeholder="Pick a specialist"
                options={[
                  { value: "nurse", label: "Nurse" },
                  { value: "adm_coordinator", label: "ADM Coordinator" },
                  { value: "principal", label: "Principal" },
                ]}
              />
            </div>
            <div className={styles.formFull}>
              <Label htmlFor="specialistReason">What help is needed?</Label>
              <Textarea
                id="specialistReason"
                value={form.specialistReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, specialistReason: e.target.value }))
                }
                placeholder="Explain what help the student needs…"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("specialist")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isActionPending ||
                !form.specialistRole ||
                !form.specialistReason
              }
              onClick={() =>
                handleAction("specialist", {
                  referredToRole: form.specialistRole,
                  reason: form.specialistReason,
                })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADM Dialog */}
      <Dialog open={dialogs.adm} onOpenChange={() => closeDialog("adm")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start ADM process</DialogTitle>
            <DialogDescription>
              Move this case into ADM (Alternative Dispute Resolution) for
              closer follow-through.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="admReason">Why does this case need ADM?</Label>
              <Textarea
                id="admReason"
                value={form.admReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, admReason: e.target.value }))
                }
                placeholder="Explain why this case needs closer follow-through…"
                maxLength={500}
              />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("adm")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.admReason}
              onClick={() => handleAction("adm", { reason: form.admReason })}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Starting…" : "Start ADM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept with intake */}
      <Dialog open={dialogs.accept} onOpenChange={() => closeDialog("accept")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept this case{activeRow ? ` — ${activeRow.student}` : ""}</DialogTitle>
            <DialogDescription>
              Record your first impressions and book the first counseling
              session. You can schedule more sessions afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <FormDropdown
              id="priority"
              label="How urgent is this?"
              value={form.priority}
              onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              placeholder="Pick urgency"
              options={[
                { value: "high", label: "High — act right away" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low — monitor for now" },
              ]}
            />
            <div className={styles.formFull}>
              <Label htmlFor="intakeNotes">First impressions (optional)</Label>
              <Textarea
                id="intakeNotes"
                value={form.intakeNotes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, intakeNotes: e.target.value }))
                }
                placeholder="What stands out? Anything the next reader should know…"
                maxLength={2000}
              />
            </div>
            <div className={styles.formFull}>
              <p className={styles.formSectionLabel}>First session (optional)</p>
            </div>
            <SessionDatePicker
              id="firstDate"
              label="Date"
              value={form.sessDate}
              onChange={(v) => setForm((f) => ({ ...f, sessDate: v }))}
            />
            <SessionTimePicker
              id="firstTime"
              label="Time"
              value={form.sessTime}
              onChange={(v) => setForm((f) => ({ ...f, sessTime: v }))}
            />
            <FormDropdown
              id="firstType"
              label="Session kind"
              value={form.sessType}
              onChange={(v) => setForm((f) => ({ ...f, sessType: v }))}
              placeholder="Pick a kind"
              options={SESSION_KIND_OPTIONS}
            />
            <div>
              <Label htmlFor="firstVenue">Venue (optional)</Label>
              <Input
                id="firstVenue"
                value={form.sessVenue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sessVenue: e.target.value }))
                }
                placeholder="e.g. Guidance office"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("accept")}
              disabled={isActionPending}
            >
              Not yet
            </Button>
            <Button
              disabled={isActionPending}
              onClick={() => {
                const when =
                  form.sessDate && form.sessTime
                    ? combineDateTime(form.sessDate, form.sessTime)
                    : null;
                handleAction("accept", {
                  priority: form.priority as "low" | "normal" | "high",
                  ...(form.intakeNotes.trim()
                    ? { intakeNotes: form.intakeNotes.trim() }
                    : {}),
                  ...(when
                    ? {
                        firstSession: {
                          scheduledAt: when,
                          sessionType: form.sessType as CounselingSessionType,
                          ...(form.sessVenue.trim()
                            ? { venue: form.sessVenue.trim() }
                            : {}),
                        },
                      }
                    : {}),
                });
              }}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Accepting…" : "Accept and start case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule a session */}
      <Dialog open={dialogs.schedule} onOpenChange={() => closeDialog("schedule")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a session</DialogTitle>
            <DialogDescription>
              Book a counseling session{activeRow ? ` for ${activeRow.student}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <SessionDatePicker
              id="sessDate"
              label="Date"
              value={form.sessDate}
              onChange={(v) => setForm((f) => ({ ...f, sessDate: v }))}
            />
            <SessionTimePicker
              id="sessTime"
              label="Time"
              value={form.sessTime}
              onChange={(v) => setForm((f) => ({ ...f, sessTime: v }))}
            />
            <FormDropdown
              id="sessType"
              label="Session kind"
              value={form.sessType}
              onChange={(v) => setForm((f) => ({ ...f, sessType: v }))}
              placeholder="Pick a kind"
              options={SESSION_KIND_OPTIONS}
            />
            <div>
              <Label htmlFor="sessVenue">Venue (optional)</Label>
              <Input
                id="sessVenue"
                value={form.sessVenue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sessVenue: e.target.value }))
                }
                placeholder="e.g. Guidance office"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("schedule")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isActionPending || !combineDateTime(form.sessDate, form.sessTime)
              }
              onClick={() => {
                const when = combineDateTime(form.sessDate, form.sessTime);
                if (!when) return;
                handleAction("schedule", {
                  scheduledAt: when,
                  sessionType: form.sessType as CounselingSessionType,
                  ...(form.sessVenue.trim()
                    ? { venue: form.sessVenue.trim() }
                    : {}),
                });
              }}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Scheduling…" : "Schedule session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark a session done */}
      <Dialog open={dialogs.finish} onOpenChange={() => closeDialog("finish")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark session done</DialogTitle>
            <DialogDescription>
              {activeSession
                ? `${sessionTypeLabel(activeSession.sessionType)} · ${formatDateTime(activeSession.scheduledAt)}${activeSession.venue ? ` · ${activeSession.venue}` : ""}`
                : "Record what happened in this session."}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <div className={styles.formFull}>
              <Label htmlFor="doneNotes">What happened in the session?</Label>
              <Textarea
                id="doneNotes"
                value={form.doneNotes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, doneNotes: e.target.value }))
                }
                placeholder="Key points discussed, student response…"
                maxLength={5000}
              />
            </div>
            <div className={styles.formFull}>
              <Label htmlFor="doneOutcome">Outcome / next step (optional)</Label>
              <Textarea
                id="doneOutcome"
                value={form.doneOutcome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, doneOutcome: e.target.value }))
                }
                placeholder="What changed? What happens next…"
                maxLength={2000}
              />
            </div>
            <div className={styles.formFull}>
              <p className={styles.formSectionLabel}>
                Book a follow-up session (optional)
              </p>
              <p className={styles.formSectionHint}>
                If this needs another talk, book it now so it stays on the plan.
              </p>
            </div>
            <SessionDatePicker
              id="followUpSessDate"
              label="Follow-up date"
              value={form.sessDate}
              onChange={(v) => setForm((f) => ({ ...f, sessDate: v }))}
            />
            <SessionTimePicker
              id="followUpSessTime"
              label="Follow-up time"
              value={form.sessTime}
              onChange={(v) => setForm((f) => ({ ...f, sessTime: v }))}
            />
            <FormDropdown
              id="followUpSessType"
              label="Follow-up kind"
              value={form.sessType}
              onChange={(v) => setForm((f) => ({ ...f, sessType: v }))}
              placeholder="Pick a kind"
              options={SESSION_KIND_OPTIONS}
            />
            <div>
              <Label htmlFor="followUpSessVenue">Venue (optional)</Label>
              <Input
                id="followUpSessVenue"
                value={form.sessVenue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sessVenue: e.target.value }))
                }
                placeholder="e.g. Guidance office"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("finish")}
              disabled={isActionPending}
            >
              Cancel
            </Button>
            <Button
              disabled={isActionPending || !form.doneNotes.trim() || !activeSessionId}
              onClick={() => {
                if (!activeSessionId) return;
                const followUpAt = combineDateTime(form.sessDate, form.sessTime);
                handleAction("finish", {
                  sessionId: activeSessionId,
                  sessionNotes: form.doneNotes.trim(),
                  ...(form.doneOutcome.trim()
                    ? { outcome: form.doneOutcome.trim() }
                    : {}),
                  ...(followUpAt
                    ? {
                        followUpSession: {
                          scheduledAt: followUpAt,
                          sessionType:
                            form.sessType as CounselingSessionType,
                          ...(form.sessVenue.trim()
                            ? { venue: form.sessVenue.trim() }
                            : {}),
                        },
                      }
                    : {}),
                });
              }}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Saving…" : "Mark done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move a session */}
      <Dialog open={dialogs.move} onOpenChange={() => closeDialog("move")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move session</DialogTitle>
            <DialogDescription>
              {activeSession
                ? `Currently ${formatDateTime(activeSession.scheduledAt)}. Pick the new date and time.`
                : "Pick the new date and time."}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.formGrid}>
            <SessionDatePicker
              id="moveDate"
              label="New date"
              value={form.sessDate}
              onChange={(v) => setForm((f) => ({ ...f, sessDate: v }))}
            />
            <SessionTimePicker
              id="moveTime"
              label="New time"
              value={form.sessTime}
              onChange={(v) => setForm((f) => ({ ...f, sessTime: v }))}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("move")}
              disabled={isActionPending}
            >
              Keep as is
            </Button>
            <Button
              disabled={
                isActionPending ||
                !activeSessionId ||
                !combineDateTime(form.sessDate, form.sessTime)
              }
              onClick={() => {
                const when = combineDateTime(form.sessDate, form.sessTime);
                if (!when || !activeSessionId) return;
                handleAction("move", { sessionId: activeSessionId, scheduledAt: when });
              }}
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Moving…" : "Move session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel a session */}
      <Dialog
        open={dialogs.cancelSess}
        onOpenChange={() => closeDialog("cancelSess")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this session?</DialogTitle>
            <DialogDescription>
              {activeSession
                ? `${sessionTypeLabel(activeSession.sessionType)} · ${formatDateTime(activeSession.scheduledAt)} will be cancelled.`
                : "This session will be cancelled."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="cancelReasonInput">Why? (optional)</Label>
            <Textarea
              id="cancelReasonInput"
              value={form.cancelReasonInput}
              onChange={(e) =>
                setForm((f) => ({ ...f, cancelReasonInput: e.target.value }))
              }
              placeholder="e.g. Student was absent, moved to next week…"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("cancelSess")}
              disabled={isActionPending}
            >
              Keep session
            </Button>
            <Button
              disabled={isActionPending || !activeSessionId}
              onClick={() =>
                activeSessionId &&
                handleAction("cancelSess", {
                  sessionId: activeSessionId,
                  ...(form.cancelReasonInput.trim()
                    ? { cancelReason: form.cancelReasonInput.trim() }
                    : {}),
                })
              }
            >
              <Busy busy={isActionPending} />
              {isActionPending ? "Cancelling…" : "Cancel session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finish & close with strict requirements */}
      <Dialog open={dialogs.resolve} onOpenChange={() => closeDialog("resolve")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish and close case</DialogTitle>
            <DialogDescription>
              Closing needs two things: at least one finished session and a
              closing summary.
            </DialogDescription>
          </DialogHeader>
          <p className={styles.resolveProgress} aria-live="polite">
            {activeRow
              ? `${activeRow.completedSessions} of ${activeRow.sessions.length} session${activeRow.sessions.length === 1 ? "" : "s"} finished`
              : "No case selected"}
          </p>
          {activeRow && activeRow.completedSessions === 0 ? (
            <p className={styles.resolveBlocker} role="note">
              Finish at least one session first — use “Schedule a session” in
              the counseling plan, then mark it done.
            </p>
          ) : null}
          <div>
            <Label htmlFor="resolveSummary">Closing summary</Label>
            <Textarea
              id="resolveSummary"
              value={form.resolveSummary}
              onChange={(e) =>
                setForm((f) => ({ ...f, resolveSummary: e.target.value }))
              }
              placeholder="What changed for the student? What was the final outcome…"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeDialog("resolve")}
              disabled={mutation.isPending}
            >
              Keep open
            </Button>
            <Button
              disabled={
                mutation.isPending ||
                isActionPending ||
                !activeId ||
                !form.resolveSummary.trim() ||
                !activeRow ||
                activeRow.completedSessions === 0
              }
              onClick={() => {
                if (!activeId) return;
                mutation.mutate({
                  id: activeId,
                  next: "resolved",
                  summary: form.resolveSummary.trim(),
                });
                setDialogs((prev) => ({ ...prev, resolve: false }));
                setActiveId(null);
              }}
            >
              <Busy busy={mutation.isPending} />
              {mutation.isPending ? "Closing…" : "Close case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official GCForm-01 report overlay — same preview the folder UI opens. */}
      <OcForm01PreviewDialog
        recordId={previewId}
        onClose={() => setPreviewId(null)}
      />

      {/* Privacy notice instead of the report on finished cases. */}
      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={() => setPrivacyFor(null)}
        studentName={privacyFor ?? undefined}
      />
    </div>
  );
}

interface GuidanceReferralsTableProps {
  referrals: GuidanceReferralItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  query: string;
  onQueryChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  onRetry: () => void;
  isRetrying: boolean;
  isNavigating: boolean;
}