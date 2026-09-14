"use client";

import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/ui/FolderCard";
import { OcForm01PreviewDialog } from "@/components/ocform01/OcForm01PreviewDialog";
import { PrivacyNoticeDialog } from "@/components/privacy-notice-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NurseQueueRowActions } from "../../overview/components/NurseQueueRowActions";
import { NurseStartHandlingDialog } from "../../overview/components/NurseStartHandlingDialog";
import type {
  NurseQueueRow,
  NurseSessionItem,
} from "../../overview/components/nurse-overview-data";
import type { NurseAlertItem } from "../../alerts/components/nurse-alerts-data";
import {
  CancelSessionDialog,
  FinishSessionDialog,
  MoveSessionDialog,
  ResolveCaseDialog,
  ScheduleSessionDialog,
} from "./NurseReferralDialogs";
import tableStyles from "@/app/guidance/referrals/components/guidance-referrals-table.module.css";
import filterStyles from "@/app/guidance/referrals/components/guidance-referrals-filters.module.css";

const PAGE_SIZE = 8;

type StatusFilter =
  | ""
  | "pending"
  | "in_progress"
  | "follow_up"
  | "info_requested"
  | "escalated"
  | "resolved"
  | "dismissed";

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All cases" },
  { value: "pending", label: "Needs action" },
  { value: "in_progress", label: "In progress" },
  { value: "follow_up", label: "Follow-up" },
  { value: "info_requested", label: "Needs more info" },
  { value: "escalated", label: "Sent to clinic" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Closed" },
];

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

/* "2026-09-20T06:30:00.000Z" -> "2:30 PM" (reader's timezone). */
function formatTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* Nurse clinic sessions are always one-on-one talks. */
function sessionKindLabel(value: string): string {
  if (value === "individual") return "One-on-one";
  return value.replace(/_/g, " ");
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
      return "Sent to clinic";
    case "follow_up":
      return "Follow-up";
    case "dismissed":
      return "Closed";
    case "info_requested":
      return "Needs more info";
    default:
      return status.replace(/_/g, " ");
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
      return "This was sent to the clinic for you to handle.";
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

function statusVariant(
  status: string
): "warning" | "destructive" | "secondary" | "outline" {
  if (status === "pending") return "warning";
  if (status === "escalated") return "destructive";
  if (status === "resolved" || status === "dismissed") return "secondary";
  return "outline";
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function StartHandlingButton({
  row,
  onChanged,
}: {
  row: NurseQueueRow;
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Start handling
      </Button>
      <NurseStartHandlingDialog
        row={row}
        open={open}
        onClose={() => setOpen(false)}
        onChanged={onChanged}
      />
    </>
  );
}

/**
 * Clinic cases sent to the nurse, newest first — the same timeline layout
 * as the guidance referrals-to-me page: toolbar with count + filters, one
 * entry per case (date rail, report body, student aside), and a pager.
 * ADM-track cases never appear here; they live on the overview queue.
 */
export function NurseAlertsTable({
  alerts,
  onChanged,
}: {
  alerts: NurseAlertItem[];
  onChanged: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("");
  const [page, setPage] = React.useState(1);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [privacyFor, setPrivacyFor] = React.useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = React.useState<NurseQueueRow | null>(null);
  const [resolveRow, setResolveRow] = React.useState<NurseQueueRow | null>(null);
  const [sessionDialog, setSessionDialog] = React.useState<{
    row: NurseQueueRow;
    session: NurseSessionItem;
    kind: "finish" | "move" | "cancel";
  } | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      if (status !== "" && a.row.status !== status) return false;
      if (
        q !== "" &&
        !`${a.row.student} ${a.row.lrn} ${a.row.section} ${a.row.reason} ${a.row.anecdotal?.incident ?? ""} ${a.row.category}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [alerts, query, status]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);
  const openCases = filtered.filter(
    (a) => a.row.status !== "resolved" && a.row.status !== "dismissed"
  ).length;
  const hasActiveFilters = query.trim() !== "" || status !== "";
  const statusFilterLabel =
    STATUSES.find((s) => s.value === status)?.label ?? "All cases";

  function clearStatus() {
    setStatus("");
    setPage(1);
  }

  return (
    <div className={tableStyles.feed}>
      <h1 className={tableStyles.srOnly}>Cases sent to the clinic</h1>
      <div className={tableStyles.toolbar}>
        <p className={tableStyles.count} aria-live="polite">
          {total === 0
            ? "No cases"
            : `${total} case${total === 1 ? "" : "s"} sent to you${
                openCases > 0
                  ? ` · ${openCases} still need${openCases === 1 ? "s" : ""} action`
                  : ""
              }`}
        </p>
        <div className={filterStyles.filters}>
          <div className={filterStyles.searchWrap}>
            <Search className={filterStyles.searchIcon} aria-hidden />
            <Input
              className={filterStyles.search}
              placeholder="Search by student name or keyword…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="Search your cases"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Filter cases by status, currently showing: ${statusFilterLabel}`}
                className={`${filterStyles.filterBtn} ${status !== "" ? filterStyles.filterActive : ""}`}
              >
                {statusFilterLabel}
                {status !== "" && <span className={filterStyles.filterDot} aria-hidden />}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={filterStyles.filterMenu}>
              {STATUSES.map((item, index) => (
                <div key={item.label}>
                  {index === 1 && <DropdownMenuSeparator />}
                  <DropdownMenuCheckboxItem
                    checked={status === item.value}
                    onCheckedChange={() => {
                      setStatus(item.value);
                      setPage(1);
                    }}
                  >
                    {item.label}
                  </DropdownMenuCheckboxItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {status !== "" && (
            <Button
              variant="ghost"
              size="sm"
              className={filterStyles.clearBtn}
              onClick={clearStatus}
            >
              <X aria-hidden />
              Show all
            </Button>
          )}
        </div>
      </div>

      {pageRows.length === 0 ? (
        <div className={tableStyles.empty}>
          <p className={tableStyles.emptyTitle}>
            {hasActiveFilters ? "No cases match your search" : "You're all caught up"}
          </p>
          <p className={tableStyles.emptyHint}>
            {hasActiveFilters
              ? "Try a different name or keyword, or clear the filter to see every case."
              : "New cases sent to you by advisers will appear here."}
          </p>
        </div>
      ) : (
        <ol className={tableStyles.timeline}>
          {pageRows.map((alert) => {
            const row = alert.row;
            const isPending = row.status === "pending";
            const canStart = row.status === "pending" || row.status === "escalated";
            const isClosed = row.status === "resolved" || row.status === "dismissed";
            const incident = row.anecdotal?.incident?.trim() || "";
            return (
              <li key={alert.key} className={tableStyles.entry}>
                <span className={tableStyles.dot} aria-hidden="true" />
                {/* Left rail — when it arrived and what state it is in */}
                <div className={tableStyles.rail}>
                  <p className={tableStyles.railDate}>
                    <time dateTime={row.date}>{formatDate(row.date)}</time>
                  </p>
                  <div className={tableStyles.railBadges}>
                    <Badge variant={statusVariant(row.status)}>
                      {statusLabel(row.status)}
                    </Badge>
                    <Badge variant="outline">{row.category}</Badge>
                  </div>
                  {statusHelp(row.status) ? (
                    <p className={tableStyles.statusHelp}>{statusHelp(row.status)}</p>
                  ) : null}
                  <p className={tableStyles.railMeta}>{alert.waiting}</p>
                </div>

                {/* Center — the report itself: reason, what happened, details */}
                <div className={tableStyles.body}>
                  <h2 className={tableStyles.reason}>{row.reason}</h2>

                  {incident || row.anecdotalId ? (
                    <div className={tableStyles.block}>
                      <p className={tableStyles.blockLabel}>What was observed</p>
                      {incident ? (
                        <p className={tableStyles.blockText}>{incident}</p>
                      ) : null}
                      {row.anecdotalId ? (
                        <button
                          type="button"
                          className={tableStyles.folderBtn}
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
                            sublabel={`${row.category} · ${formatDate(row.date)}`}
                            files={[
                              {
                                name: `OCForm-01_${row.date}`,
                                tag: `${row.category} • ${timeAgo(row.date)}`,
                                icon: "doc",
                              },
                            ]}
                          />
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {row.anecdotal && row.anecdotal.location !== "—" ? (
                    <dl className={tableStyles.metaGrid}>
                      <div className={tableStyles.metaItem}>
                        <dt>Where it happened</dt>
                        <dd>{row.anecdotal.location}</dd>
                      </div>
                    </dl>
                  ) : null}

                  {row.intakeNotes ? (
                    <p className={tableStyles.calloutMuted}>
                      <span className={tableStyles.calloutPrefix}>First impressions: </span>
                      {row.intakeNotes}
                    </p>
                  ) : null}
                  {row.followUpDate ? (
                    <p className={tableStyles.callout}>
                      Reminder: check back on{" "}
                      <time dateTime={row.followUpDate}>
                        {formatDate(row.followUpDate)}
                      </time>
                      .
                    </p>
                  ) : null}
                  {row.escalationReason ? (
                    <p className={tableStyles.callout}>
                      Sent to the clinic: {row.escalationReason}
                    </p>
                  ) : null}
                  {row.notes ? (
                    <p className={tableStyles.calloutMuted}>
                      <span className={tableStyles.calloutPrefix}>Internal note: </span>
                      {row.notes}
                    </p>
                  ) : null}

                  {/* Clinic sessions — the real work on an accepted case */}
                  {isPending ? (
                    <p className={tableStyles.planHint}>
                      Start handling this case to record your first impressions and
                      schedule clinic sessions.
                    </p>
                  ) : (
                    <div className={tableStyles.plan}>
                      <div className={tableStyles.planHead}>
                        <p className={tableStyles.blockLabel}>Clinic sessions</p>
                        {!isClosed ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setScheduleFor(row)}
                          >
                            Schedule a session
                          </Button>
                        ) : null}
                      </div>
                      {isClosed ? (
                        <p className={tableStyles.planEmpty}>
                          This case is closed — the sessions below are kept as
                          history and can&apos;t be changed.
                        </p>
                      ) : null}
                      {row.sessions.length === 0 ? (
                        <p className={tableStyles.planEmpty}>
                          No sessions yet — schedule the first talk with{" "}
                          {row.student.split(" ")[0]}.
                        </p>
                      ) : (
                        <ul className={tableStyles.sessionList}>
                          {row.sessions.map((s) => (
                            <li key={s.id} className={tableStyles.session}>
                              <div className={tableStyles.sessionTop}>
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
                                <p className={tableStyles.sessionTitle}>
                                  {sessionKindLabel(s.sessionType)}
                                </p>
                              </div>
                              <ul className={tableStyles.sessionFacts}>
                                <li>
                                  <time dateTime={s.scheduledAt}>
                                    {formatDate(s.date)}
                                  </time>
                                </li>
                                <li>{formatTime(s.scheduledAt)}</li>
                                {s.venue ? <li>{s.venue}</li> : null}
                              </ul>
                              {s.status === "completed" && s.sessionNotes ? (
                                <p className={tableStyles.sessionNotes}>
                                  {s.sessionNotes}
                                </p>
                              ) : null}
                              {s.status === "completed" && s.outcome ? (
                                <p className={tableStyles.sessionOutcome}>
                                  <span className={tableStyles.calloutPrefix}>
                                    Outcome:{" "}
                                  </span>
                                  {s.outcome}
                                </p>
                              ) : null}
                              {s.status === "cancelled" && s.cancelReason ? (
                                <p className={tableStyles.sessionOutcome}>
                                  {s.cancelReason}
                                </p>
                              ) : null}
                              {s.status === "scheduled" && !isClosed && (
                                <div className={tableStyles.sessionActions}>
                                  <Button
                                    type="button"
                                    size="xs"
                                    onClick={() =>
                                      setSessionDialog({ row, session: s, kind: "finish" })
                                    }
                                  >
                                    Mark done
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    onClick={() =>
                                      setSessionDialog({ row, session: s, kind: "move" })
                                    }
                                  >
                                    Move
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    onClick={() =>
                                      setSessionDialog({ row, session: s, kind: "cancel" })
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

                  <div className={tableStyles.actions}>
                    {canStart && (
                      <StartHandlingButton row={row} onChanged={onChanged} />
                    )}
                    {!isClosed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResolveRow(row)}
                      >
                        Finish &amp; close
                      </Button>
                    )}
                    <NurseQueueRowActions
                      row={row}
                      onChanged={onChanged}
                      hiddenItems={["start", "resolve"]}
                    />
                  </div>
                </div>

                {/* Right — who this case is about */}
                <aside
                  className={tableStyles.student}
                  aria-label={`About the student: ${row.student}`}
                >
                  <p className={tableStyles.studentCaption}>Student</p>
                  <div className={tableStyles.studentRow}>
                    <Avatar className={tableStyles.avatar} aria-hidden="true">
                      <AvatarFallback>{initials(row.student)}</AvatarFallback>
                    </Avatar>
                    <div className={tableStyles.studentText}>
                      <p className={tableStyles.studentName}>{row.student}</p>
                      {row.lrn ? (
                        <p className={tableStyles.studentSub}>
                          ID <span className={tableStyles.lrn}>{row.lrn}</span>
                        </p>
                      ) : null}
                      <p className={tableStyles.studentSub}>
                        {row.section}
                        {row.grade && row.grade !== "—" ? ` · ${row.grade}` : ""}
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
      <nav className={tableStyles.pager} aria-label="Cases pages">
        <p className={tableStyles.range}>
          Showing cases {start}–{end} of {total}
        </p>
        <div className={tableStyles.pagerButtons}>
          <Button
            size="sm"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Show newer cases"
          >
            ← Newer
          </Button>
          <span className={tableStyles.pageLabel} aria-live="polite">
            Page {safePage} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Show older cases"
          >
            Older →
          </Button>
        </div>
      </nav>

      <OcForm01PreviewDialog recordId={previewId} onClose={() => setPreviewId(null)} />

      <PrivacyNoticeDialog
        open={privacyFor !== null}
        onClose={() => setPrivacyFor(null)}
        studentName={privacyFor ?? undefined}
      />

      {scheduleFor && (
        <ScheduleSessionDialog
          referralId={scheduleFor.id}
          student={scheduleFor.student}
          open
          onClose={() => setScheduleFor(null)}
          onChanged={onChanged}
        />
      )}
      {resolveRow && (
        <ResolveCaseDialog
          row={resolveRow}
          open
          onClose={() => setResolveRow(null)}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "finish" && (
        <FinishSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          open
          onClose={() => setSessionDialog(null)}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "move" && (
        <MoveSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          open
          onClose={() => setSessionDialog(null)}
          onChanged={onChanged}
        />
      )}
      {sessionDialog && sessionDialog.kind === "cancel" && (
        <CancelSessionDialog
          referralId={sessionDialog.row.id}
          session={sessionDialog.session}
          open
          onClose={() => setSessionDialog(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
