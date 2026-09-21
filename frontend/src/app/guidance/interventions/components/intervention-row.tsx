"use client";

import * as React from "react";
import {
  Bell,
  CalendarPlus,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  Eye,
  FileText,
  Flag,
  Hourglass,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  formatDateTime,
  sessionTypeLabel,
} from "../../referrals/components/guidance-referrals-table";
import type {
  AtRiskStudentItem,
  CounselingSessionItem,
} from "./guidance-interventions-data";
import { CounselingPlan } from "./counseling-plan";
import { Busy } from "./busy";
import { ImageViewer } from "@/components/image-viewer/ImageViewer";
import { listInterventionSessionDocs } from "./guidance-interventions-data";
import rowStyles from "./intervention-row.module.css";
import styles from "./guidance-interventions.module.css";

function approvalLabel(value: string): string {
  switch (value) {
    case "pending":
      return "Waiting for review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "modified":
      return "Changed";
    default:
      return value;
  }
}

function outcomeLabel(value: string): string {
  switch (value) {
    case "ongoing":
      return "Ongoing";
    case "resolved":
      return "Resolved";
    case "unresolved":
      return "Not resolved";
    default:
      return value;
  }
}

/* One icon per latest-action kind — same mapping as the alerts table.
   Static per-branch JSX (module scope) so no component is created during
   render. */
function ActionGlyph({ label, className }: { label: string; className?: string }) {
  const text = label.toLowerCase();
  const props = { className, "aria-hidden": true } as const;
  if (text.includes("booked")) return <CalendarPlus {...props} />;
  if (text.includes("done") || text.includes("resolv")) return <CircleCheck {...props} />;
  if (text.includes("cancel") || text.includes("reject")) return <CircleX {...props} />;
  if (text.includes("documentation") || text.includes("filed") || text.includes("note"))
    return <FileText {...props} />;
  if (text.includes("follow")) return <Flag {...props} />;
  if (text.includes("accept") || text.includes("approv")) return <Check {...props} />;
  if (
    text.includes("escalat") ||
    text.includes("sent") ||
    text.includes("endors") ||
    text.includes("assign") ||
    text.includes("intervention")
  )
    return <Send {...props} />;
  if (text.includes("review") || text.includes("needs")) return <Eye {...props} />;
  if (text.includes("waiting") || text.includes("information")) return <Hourglass {...props} />;
  return <Bell {...props} />;
}

/* Latest intervention activity: newest session first, else the moment the
   intervention was opened. Mirrors the alerts table. Session timing uses
   execution stamps (createdAt = when booked, completedAt = when done) —
   never the future appointment as the action time. */
export function interventionLatestAction(item: AtRiskStudentItem): {
  label: string;
  time: string;
} {
  const iv = item.intervention;
  if (iv && iv.sessions.length > 0) {
    const actionTimeOf = (s: CounselingSessionItem) =>
      s.completedAt || s.createdAt || s.scheduledAt;
    const sorted = [...iv.sessions].sort((a, b) => {
      const at = new Date(actionTimeOf(a)).getTime();
      const bt = new Date(actionTimeOf(b)).getTime();
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });
    const newest = sorted[0];
    if (newest.status === "completed") {
      return { label: "Session done", time: newest.completedAt || newest.createdAt || newest.scheduledAt };
    }
    if (newest.status === "cancelled") {
      return { label: "Session cancelled", time: newest.createdAt || newest.scheduledAt };
    }
    return { label: "Session booked", time: newest.createdAt || newest.scheduledAt };
  }
  if (iv?.createdAt) return { label: "Intervention opened", time: iv.createdAt };
  return { label: "No follow-up yet", time: "" };
}

export function msSinceAction(time: string, now: number): number | null {
  if (!time || time === "—") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(time) ? `${time}T00:00:00` : time;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, now - t);
}

export function formatElapsedShort(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return "just now";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
}

interface InterventionTableRowProps {
  row: AtRiskStudentItem;
  locked: boolean;
  isActionPending: boolean;
  isBusy: (action: string) => boolean;
  planCollapsed: boolean;
  onTogglePlan: () => void;
  expanded: boolean;
  onToggleDetails: () => void;
  now: number;
  onStart: () => void;
  onChange: () => void;
  onOutcome: () => void;
  onSchedule: () => void;
  onSession: (
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess"
  ) => void;
  onReview: (decision: "approved" | "rejected") => void;
  onDocsChanged: () => void;
}

/**
 * One intervention as an alerts-style table row (LRN, type, case status,
 * risk, latest action, elapsed, date, row menu) plus an expandable detail
 * row carrying the risk factors, follow-up context, session plan, and the
 * full desk actions.
 */
export function InterventionTableRow({
  row,
  locked,
  isActionPending,
  isBusy,
  planCollapsed,
  onTogglePlan,
  expanded,
  onToggleDetails,
  now,
  onStart,
  onChange,
  onOutcome,
  onSchedule,
  onSession,
  onReview,
  onDocsChanged,
}: InterventionTableRowProps) {
  const followUp = row.intervention;
  const [sessionsOpen, setSessionsOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [viewer, setViewer] = React.useState<{
    files: { id: string; fileUrl: string; fileName: string }[];
    index: number;
  } | null>(null);
  const [viewerLoading, setViewerLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [showScrollDown, setShowScrollDown] = React.useState(false);

  const filesTotal =
    followUp?.sessions.reduce((n, s) => n + (s.attachmentsCount ?? 0), 0) ?? 0;

  // Open every filed image across the follow-up's sessions in the shared
  // gallery viewer (same modal as the nurse health-records desk).
  async function openRowViewer() {
    if (!followUp || viewerLoading) return;
    setViewerLoading(true);
    try {
      const parts = await Promise.all(
        followUp.sessions.map(async (s) => {
          if ((s.attachmentsCount ?? 0) === 0) return [];
          const docs = await listInterventionSessionDocs(followUp.id, s.id);
          return docs.map((d) => ({
            id: d.id,
            fileUrl: d.fileUrl,
            fileName: `${sessionTypeLabel(s.sessionType)} — ${d.fileName}`,
          }));
        })
      );
      const files = parts.flat();
      if (files.length === 0) {
        toast.error({ title: "No attached images", description: "No documentary images filed on this case yet." });
        return;
      }
      setViewer({ files, index: 0 });
    } catch {
      toast.error({ title: "Could not load images", description: "Check your connection and try again." });
    } finally {
      setViewerLoading(false);
    }
  }

  const updateScrollBtn = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setShowScrollDown(false);
      return;
    }
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 40);
  }, []);

  // Re-measure whenever the sheet opens or its content changes (sessions
  // expand/collapse, dialogs that resize content). No state reset here:
  // the sheet unmounts on close, and reopening re-measures below.
  React.useEffect(() => {
    if (!expanded) return;
    updateScrollBtn();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateScrollBtn());
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, planCollapsed, followUp, updateScrollBtn]);
  const closed = !!followUp && followUp.outcomeStatus === "resolved";
  // Done pipeline stages (sessions finished, case still open) can take the
  // next follow-up session straight from the menu.
  const canScheduleFollowUp =
    !!followUp &&
    !closed &&
    followUp.approvalStatus !== "rejected" &&
    followUp.completedSessions > 0;
  const workable =
    !!followUp &&
    followUp.outcomeStatus !== "resolved" &&
    followUp.approvalStatus !== "rejected";

  const latest = interventionLatestAction(row);
  const actionMs = latest.time ? msSinceAction(latest.time, now) : null;
  const doneCount = followUp?.completedSessions ?? 0;
  const scheduledCount =
    followUp?.sessions.filter((s) => s.status === "scheduled").length ?? 0;
  // Booked pipeline stage (upcoming session, nothing finished): booking
  // another is blocked, so the menu offers to move the booked one instead.
  const scheduledSession =
    followUp?.sessions.find((s) => s.status === "scheduled") ?? null;
  const canReschedule =
    !!scheduledSession &&
    !closed &&
    followUp?.approvalStatus !== "rejected" &&
    doneCount === 0;

  // Pipeline stage — where this case sits from intake to close-out:
  // no action yet → started/booked → session done → done, with a follow-up
  // session stage when the next talk is already booked, plus discontinued
  // and no-longer-at-risk terminals for cases that will not continue.
  function pipelineStatus(): {
    label: string;
    variant: "default" | "success" | "secondary" | "destructive" | "outline" | "warning";
    sub: string | null;
  } {
    if (followUp?.outcomeStatus === "resolved")
      return { label: "Done", variant: "success", sub: null };
    if (followUp?.outcomeStatus === "unresolved")
      return { label: "Discontinued", variant: "secondary", sub: null };
    if (followUp && row.riskLevel === "Low")
      return { label: "No longer at risk", variant: "secondary", sub: "Risk factors cleared" };
    // Opened but nothing booked yet reads the same as no follow-up at all.
    if (!followUp || followUp.sessions.length === 0)
      return { label: "No action yet", variant: "outline", sub: null };
    if (scheduledCount > 0 && doneCount > 0)
      return {
        label: "Follow-up session",
        variant: "default",
        sub: `${doneCount} session${doneCount === 1 ? "" : "s"} done`,
      };
    if (scheduledCount > 0) return { label: "Booked session", variant: "default", sub: null };
    if (doneCount > 0)
      return {
        label: "Session done",
        variant: "success",
        sub: `${doneCount} session${doneCount === 1 ? "" : "s"} done`,
      };
    return { label: "No action yet", variant: "outline", sub: null };
  }
  const status = pipelineStatus();
  // Opened follow-up with zero sessions booked — menu leads with booking.
  const isUnbooked =
    !!followUp && !closed && followUp.sessions.length === 0;
  // Outcome and hand-offs lock while a booked session is still upcoming —
  // finish or cancel it first (server enforces this too).
  const hasUpcoming = scheduledCount > 0;
  const upcomingHint = "Finish or cancel the upcoming session first";
  // Engine detection moment (RiskSnapshot date for the active term),
  // falling back to the follow-up opened date for legacy rows.
  const detectedAt = row.detectedAt ?? followUp?.createdAt ?? null;
  const detectedDate = (() => {
    if (!detectedAt) return null;
    const d = new Date(detectedAt);
    return Number.isFinite(d.getTime()) ? d : null;
  })();
  const detectedText = detectedDate
    ? detectedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const detectedTimeText = detectedDate
    ? detectedDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <>
      <TableRow>
        <TableCell>
          <p className={styles.cellMain}>{row.student}</p>
          <p className={styles.cellSub}>
            <span className={styles.lrn}>{row.lrn || "—"}</span>
          </p>
        </TableCell>
        <TableCell>
          <p className={styles.cellMain}>{row.grade || "—"}</p>
        </TableCell>
        <TableCell>
          <p className={styles.cellMain}>{row.section || "—"}</p>
        </TableCell>
        <TableCell>
          <Badge
            variant={
              row.riskLevel === "High"
                ? "destructive"
                : row.riskLevel === "Moderate"
                  ? "warning"
                  : "outline"
            }
          >
            {row.riskLevel}
          </Badge>
        </TableCell>
        <TableCell>
          <p className={styles.cellMain}>{detectedText}</p>
          <p className={styles.cellSub} aria-live="off">
            {detectedTimeText ?? "—"}
          </p>
        </TableCell>
        <TableCell>
          <p className={styles.actionLabel}>
            <ActionGlyph label={latest.label} className={styles.actionIcon} />
            <span>{latest.label}</span>
          </p>
          <p className={styles.cellSub} aria-live="off">
            {actionMs === null ? "—" : `${formatElapsedShort(actionMs)} ago`}
          </p>
        </TableCell>
        <TableCell>
          <Badge variant={status.variant}>{status.label}</Badge>
          {status.sub ? <p className={styles.cellSub}>{status.sub}</p> : null}
        </TableCell>
        <TableCell>
          {filesTotal === 0 ? (
            <span className={styles.noFiles}>—</span>
          ) : (
            <button
              type="button"
              className={styles.filesIconBtn}
              onClick={() => void openRowViewer()}
              disabled={viewerLoading}
              aria-label={`View ${filesTotal} attached image${filesTotal === 1 ? "" : "s"}`}
              title={`${filesTotal} image${filesTotal === 1 ? "" : "s"} — click to view`}
            >
              <ImageIcon size={18} aria-hidden />
              {viewerLoading ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <span className={styles.filesCount} aria-hidden>
                  {filesTotal > 1 ? `×${filesTotal}` : ""}
                </span>
              )}
            </button>
          )}
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.student}'s intervention`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              {closed ? (
                <>
                  <DropdownMenuItem onSelect={onToggleDetails}>
                    See details
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                    View session history
                  </DropdownMenuItem>
                  {filesTotal > 0 && (
                    <DropdownMenuItem
                      disabled={viewerLoading}
                      onSelect={() => void openRowViewer()}
                    >
                      {viewerLoading ? "Loading files…" : "See attached files"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={locked || isActionPending}
                    onSelect={onStart}
                  >
                    Schedule for follow up
                  </DropdownMenuItem>
                </>
              ) : isUnbooked ? (
                <>
                  <DropdownMenuItem
                    disabled={locked || isActionPending}
                    onSelect={onSchedule}
                  >
                    Book session
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onToggleDetails}>
                    See details
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => setSessionsOpen(true)}>
                    Booked session
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onToggleDetails}>
                    See details
                  </DropdownMenuItem>
                  {/* No upcoming session left (e.g. the booking was
                      cancelled) — offer booking again from the menu too. */}
                  {!scheduledSession && workable && (
                    <DropdownMenuItem
                      disabled={locked || isActionPending}
                      onSelect={onSchedule}
                    >
                      Book session
                    </DropdownMenuItem>
                  )}
                  {canReschedule && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={locked || isActionPending}
                        onSelect={() => onSession(scheduledSession, "move")}
                      >
                        Reschedule
                      </DropdownMenuItem>
                    </>
                  )}
                  {canScheduleFollowUp && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={locked || isActionPending}
                        onSelect={onSchedule}
                      >
                        Schedule for follow up
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog
            open={sessionsOpen}
            onOpenChange={(open) => {
              if (!open) setSessionsOpen(false);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Booked sessions</DialogTitle>
                <DialogDescription>
                  Counseling sessions for {row.student}.
                </DialogDescription>
              </DialogHeader>
              {!followUp || followUp.sessions.length === 0 ? (
                <p className={styles.empty}>No sessions booked yet.</p>
              ) : (
                <ul className={styles.sessList}>
                  {followUp.sessions.map((s) => (
                    <li key={s.id} className={styles.sessItem}>
                      <div className={styles.sessMain}>
                        <p className={styles.sessTitle}>{sessionTypeLabel(s.sessionType)}</p>
                        <p className={styles.sessSub}>
                          {formatDateTime(s.scheduledAt)}
                          {s.venue ? ` · ${s.venue}` : ""}
                        </p>
                      </div>
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
                    </li>
                  ))}
                </ul>
              )}
            </DialogContent>
          </Dialog>
          <Dialog
            open={historyOpen}
            onOpenChange={(open) => {
              if (!open) setHistoryOpen(false);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Session history</DialogTitle>
                <DialogDescription>
                  Every session on {row.student}&apos;s closed follow-up.
                </DialogDescription>
              </DialogHeader>
              {!followUp || followUp.sessions.length === 0 ? (
                <p className={styles.empty}>No sessions on record.</p>
              ) : (
                <ul className={styles.sessList}>
                  {followUp.sessions.map((s) => (
                    <li key={s.id} className={styles.sessItem}>
                      <div className={styles.sessMain}>
                        <p className={styles.sessTitle}>{sessionTypeLabel(s.sessionType)}</p>
                        <p className={styles.sessSub}>
                          {formatDateTime(s.scheduledAt)}
                          {s.venue ? ` · ${s.venue}` : ""}
                        </p>
                        {s.status === "completed" && s.sessionNotes ? (
                          <p className={styles.sessSub}>{s.sessionNotes}</p>
                        ) : null}
                        {s.status === "completed" && s.outcome ? (
                          <p className={styles.sessSub}>Outcome: {s.outcome}</p>
                        ) : null}
                        {s.status === "cancelled" && s.cancelReason ? (
                          <p className={styles.sessSub}>{s.cancelReason}</p>
                        ) : null}
                      </div>
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
                    </li>
                  ))}
                </ul>
              )}
            </DialogContent>
          </Dialog>
        </TableCell>
      </TableRow>
      <Sheet
        open={expanded}
        onOpenChange={(open) => {
          if (!open) onToggleDetails();
        }}
      >
        <SheetContent
          className="overflow-x-hidden p-4"
          style={{ maxWidth: "48rem" }}
        >
          <SheetHeader>
            <SheetTitle className={styles.srOnly}>{row.student}</SheetTitle>
          </SheetHeader>
          <div
            className={styles.sheetScroll}
            ref={scrollRef}
            onScroll={updateScrollBtn}
          >
            <div className={styles.sheetSections}>
              <section className={styles.sheetCard} aria-label="Case summary">
                <p className={styles.detailLabel}>Case summary</p>
                <p className={styles.summaryName}>{row.student}</p>
                <div className={styles.chipRow}>
                  <div className={styles.chip}>
                    <span className={styles.chipLabel}>LRN</span>
                    <span className={styles.lrn}>{row.lrn || "—"}</span>
                  </div>
                  <div className={styles.chip}>
                    <span className={styles.chipLabel}>Section</span>
                    <span>{row.section || "—"}</span>
                  </div>
                  <div className={styles.chip}>
                    <span className={styles.chipLabel}>Grade</span>
                    <span>{row.grade || "—"}</span>
                  </div>
                  <div className={styles.chip}>
                    <span className={styles.chipLabel}>Risk level</span>
                    <Badge
                      variant={
                        row.riskLevel === "High"
                          ? "destructive"
                          : row.riskLevel === "Moderate"
                            ? "warning"
                            : "outline"
                      }
                    >
                      {row.riskLevel}
                    </Badge>
                  </div>
                  <div className={styles.chip}>
                    <span className={styles.chipLabel}>Status</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className={styles.chip}>
                    <span className={styles.chipLabel}>Detected</span>
                    <span>
                      {detectedText}
                      {detectedTimeText ? ` · ${detectedTimeText}` : ""}
                    </span>
                  </div>
                </div>
              </section>
              <section className={styles.sheetCard} aria-label="Why at risk">
                <p className={styles.detailLabel}>Why at risk</p>
                <ul className={rowStyles.factorList}>
                  {row.factors.academic && <li>Low grades</li>}
                  {row.factors.attendance && <li>Absences</li>}
                  {row.factors.behavioral && <li>Behavior report</li>}
                </ul>
                {row.referralContext.open > 0 || row.referralContext.closed > 0 ? (
                  <p className={rowStyles.cellSub}>
                    Also has adviser-referred cases:{" "}
                    {[
                      row.referralContext.open > 0
                        ? `${row.referralContext.open} open`
                        : "",
                      row.referralContext.closed > 0
                        ? `${row.referralContext.closed} resolved`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {followUp?.priority === "high" ? (
                  <p className={rowStyles.cellSub}>High priority</p>
                ) : null}
              </section>
              <section className={styles.sheetSection} aria-label="Follow-up">
                {!followUp ? (
                  <p className={rowStyles.cellMuted}>No follow-up yet</p>
                ) : (
                  <div className={rowStyles.followUpCell}>
                    <div className={styles.noteBox}>
                      <p className={styles.noteLabel}>Note</p>
                      <p className={styles.noteText}>{followUp.recommendedAction}</p>
                    </div>
                    {(followUp.approvalStatus !== "approved" ||
                      followUp.outcomeStatus !== "ongoing") && (
                      <div className={rowStyles.badgeRow}>
                        {followUp.approvalStatus !== "approved" && (
                          <Badge
                            variant={
                              followUp.approvalStatus === "pending"
                                ? "warning"
                                : followUp.approvalStatus === "rejected"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {approvalLabel(followUp.approvalStatus)}
                          </Badge>
                        )}
                        {followUp.outcomeStatus !== "ongoing" && (
                          <Badge
                            variant={
                              followUp.outcomeStatus === "resolved"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {outcomeLabel(followUp.outcomeStatus)}
                          </Badge>
                        )}
                      </div>
                    )}
                    {followUp.outcomeNotes ? (
                      <p className={rowStyles.cellSub}>{followUp.outcomeNotes}</p>
                    ) : null}
                    {followUp.intakeNotes ? (
                      <p className={rowStyles.cellSub}>
                        <span className={rowStyles.cellPrefix}>First impressions: </span>
                        {followUp.intakeNotes}
                      </p>
                    ) : null}
                    <CounselingPlan
                      followUp={followUp}
                      studentFirstName={row.student.split(" ")[0]}
                      workable={workable}
                      closed={closed}
                      rejected={followUp.approvalStatus === "rejected"}
                      collapsed={planCollapsed}
                      onToggle={onTogglePlan}
                      locked={locked}
                      isActionPending={isActionPending}
                      isBusy={isBusy}
                      onSchedule={onSchedule}
                      onSession={onSession}
                      onDocsChanged={onDocsChanged}
                    />
                  </div>
                )}
              </section>
            </div>
            {showScrollDown && (
              <button
                type="button"
                className={styles.scrollDownBtn}
                onClick={() =>
                  scrollRef.current?.scrollBy({
                    top: Math.max(
                      200,
                      (scrollRef.current?.clientHeight ?? 400) * 0.8
                    ),
                    behavior: "smooth",
                  })
                }
              >
                <ChevronDown aria-hidden="true" />
                Scroll down
              </button>
            )}
          </div>
          <div className={styles.sheetFooter} aria-label="Actions">
            <div className={styles.sheetFooterActions}>
                  {!followUp && (
                    <Button
                      type="button"
                      disabled={locked || isActionPending}
                      onClick={onStart}
                      title="Start the follow-up and book the first session"
                    >
                      <Busy busy={isBusy("start")} />
                      Book session
                    </Button>
                  )}
                  {isUnbooked && (
                    <Button
                      type="button"
                      disabled={locked || isActionPending}
                      onClick={onSchedule}
                    >
                      Book session
                    </Button>
                  )}

                  {followUp?.approvalStatus === "pending" && (
                    <>
                      <Button
                        type="button"
                        disabled={locked || isActionPending}
                        onClick={() => onReview("approved")}
                      >
                        <Busy busy={isBusy("review")} />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={locked || isActionPending}
                        onClick={onChange}
                      >
                        Change…
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={locked || isActionPending}
                        onClick={() => onReview("rejected")}
                      >
                        <Busy busy={isBusy("review")} />
                        Reject
                      </Button>
                    </>
                  )}
                  {followUp && !closed && status.label !== "No action yet" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={locked || isActionPending || hasUpcoming}
                      title={hasUpcoming ? upcomingHint : undefined}
                      onClick={onOutcome}
                    >
                      Record outcome…
                    </Button>
                  )}
                  {followUp && closed && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={locked || isActionPending}
                        onClick={onOutcome}
                        title="Update the closing notes on this finished follow-up"
                      >
                        Add note
                      </Button>
                      <Button
                        type="button"
                        disabled={locked || isActionPending}
                        onClick={onStart}
                        title="This student is still at risk — open a new follow-up"
                      >
                      <Busy busy={isBusy("start")} />
                      Start new follow-up
                    </Button>
                    </>
                  )}
                </div>
          </div>
        </SheetContent>
      </Sheet>
      {viewer && (
        <ImageViewer
          files={viewer.files}
          index={viewer.index}
          title={row.student}
          subtitle={`${row.lrn || "—"}${row.section ? ` · ${row.section}` : ""}${row.grade ? ` · ${row.grade}` : ""}`}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}
