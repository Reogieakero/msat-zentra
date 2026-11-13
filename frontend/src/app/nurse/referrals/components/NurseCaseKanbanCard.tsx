"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderCard, type FolderFile } from "@/components/ui/FolderCard";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill, type PillTone } from "@/components/ui/pill";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  SessionPlanCard,
  sessionBoardDialogWidth,
} from "@/components/session-plan/SessionPlanCard";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { ANECDOTAL_CATEGORY_TONES } from "@/components/anecdotal/anecdotal-record-kanban-card";
import {
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Eye,
  FileText,
  History,
  MessageSquareText,
  Send,
  X,
} from "lucide-react";
import { NurseAdmReviewDialog } from "../../overview/components/NurseAdmReviewDialog";
import { NurseStartHandlingDialog } from "../../overview/components/NurseStartHandlingDialog";
import type { AdmReviewDraft } from "@/components/adm-review/AdmReviewDialog";
import type {
  NurseAlertItem,
  NurseQueueRow,
  NurseSessionItem,
} from "@/services/nurse/nurse.types";
import type { SessionDialogKind } from "./NurseReferralEntry";
import {
  anecdotalCategoryColor,
  formatActionTime,
  caseStage,
  formatDate,
  formatTime,
  hasScheduledSession,
  isCaseDone,
  isEndorsed,
  isWithdrawn,
  latestActionOf,
  latestSessionOf,
  rowStatusHelp,
  sessionKindLabel,
  timeAgo,
} from "./nurse-referrals-format";

/* Case-stage chip colours carried by the shared Pill (one tone per stage). */
const STAGE_TONE: Record<string, PillTone> = {
  amber: "amber",
  blue: "blue",
  green: "green",
  violet: "violet",
  red: "red",
  outline: "neutral",
};

/* Icon-only detail trigger — reason / observed / latest update / escalation
   live behind these and open as floating kanban boards beside the card (no
   overlay). */
const ICON_BTN =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted hover:text-foreground";

/**
 * Icon trigger whose floating kanban board appears on hover — no click
 * needed. Hover cards ignore touch input (Radix blocks the tap), so touch
 * desks toggle via pointerdown instead and keep the old access.
 */
function DetailHover({
  icon,
  ariaLabel,
  boardTitle,
  description,
  children,
}: {
  icon: React.ReactNode;
  ariaLabel: string;
  boardTitle: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={120}
      closeDelay={200}
    >
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={ICON_BTN}
          aria-label={ariaLabel}
          onPointerDown={(event) => {
            if (event.pointerType === "touch") setOpen((v) => !v);
          }}
        >
          {icon}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-80 border-0 bg-transparent p-0 shadow-none ring-0"
      >
        <KanbanBoard
          className="bg-card"
          title={boardTitle}
          icon={icon}
          description={description}
        >
          <p className="m-0 px-1 text-[12px] leading-relaxed text-foreground">
            {children}
          </p>
        </KanbanBoard>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Referral case kanban card — the anecdotal shared folder card anatomy
 * (column shell, header row, pills, folder) with the referral's contents
 * surfaced as pills and icon-button detail popovers. Shared by the nurse
 * boards' grid layouts (ADM cases and Clinic matters) — the actions follow
 * the case's type (ADM review vs clinic review/booking).
 */
export function NurseCaseKanbanCard({
  alert,
  highlighted = false,
  now,
  boardOpen,
  onBoardChange,
  onPreview,
  onPrivacy,
  onEndorsedNotice,
  onSession,
  onDocs,
  onSchedule,
  onCreateReferral,
  onChanged,
}: {
  alert: NurseAlertItem;
  highlighted?: boolean;
  now: number;
  /** The Clinic sessions board is owned by the page so a confirmed action
      can close it at once (the Dock carries the request). */
  boardOpen: boolean;
  onBoardChange: (open: boolean) => void;
  onPreview: (recordId: string) => void;
  onPrivacy: (studentName: string) => void;
  /** Endorsed case — the folder opens the "with the ADM coordinator" notice. */
  onEndorsedNotice: (studentName: string) => void;
  onSession: (
    row: NurseQueueRow,
    session: NurseSessionItem,
    kind: SessionDialogKind,
  ) => void;
  onDocs: (row: NurseQueueRow, session: NurseSessionItem) => void;
  onSchedule: (row: NurseQueueRow) => void;
  onCreateReferral: (row: NurseQueueRow, draft: AdmReviewDraft) => void;
  onChanged: () => void;
}) {
  const row = alert.row;
  const isAdm = row.type === "ADM";
  const isPending = row.status === "pending";
  /* Same closure rule as the guidance ADM card: only a resolved/rejected case
     is closed. A case that merely has a completed session keeps its session
     trail and card actions (it may still await endorsement). */
  const isClosed = row.status === "resolved" || row.status === "dismissed";
  /* Rejected / withdrawn cases drop their session trail from the card: a booked
     session on a case the desk rejected (or the teacher withdrew) is history the
     board does not surface. */
  const hidesSessionInfo = row.status === "dismissed";
  const isEndorsedRow = isEndorsed(row.type, row.status);
  /* ADM cases stay reviewable until they are cancelled or rejected. */
  const canReviewAdm = isAdm && !isWithdrawn(row) && row.status !== "dismissed";
  const canManageSessions = !isAdm || (isAdm && row.status === "pending");
  const booked = hasScheduledSession(row.sessions);
  /* Done cases keep their completed session rows but must not offer another
     booking — the case is finished. */
  const done = isCaseDone(row);
  // A cancelled most recent session leaves no scheduled one behind — say so
  // on the card instead of silently dropping the "Session booked" pill.
  const cancelled =
    !booked && latestSessionOf(row.sessions)?.status === "cancelled";
  const incident = row.anecdotal?.incident?.trim() || "";
  const latest = latestActionOf(row, alert);
  const category = row.anecdotal?.category ?? row.category;
  const categoryColor = anecdotalCategoryColor(category);
  const categoryTone =
    ANECDOTAL_CATEGORY_TONES[(category ?? "").trim().toLowerCase()] ?? 1;
  const title =
    row.category && row.category !== "—"
      ? row.category
      : isAdm
        ? "ADM case"
        : "Clinic case";
  const statusHelp = rowStatusHelp(row.type, row.status, row);
  const stage = caseStage(row);
  const waiting =
    row.waitingDays !== null && row.waitingDays > 0
      ? `waiting ${row.waitingDays}d`
      : "";
  const [reviewOpen, setReviewOpen] = React.useState(false);
  /* Clinic pendings open the clinic review overlay (accept + optional first
     session) — the clinic counterpart of the ADM review dialog. */
  const [clinicReviewOpen, setClinicReviewOpen] = React.useState(false);

  /* The folder carries the case's latest document. The referral form
     (GCForm-03) only exists once the case is endorsed — before that the
     anecdotal report (GCForm-01) is what's on file, and a case with neither
     shows no document. Endorsed / finished cases keep the folder as a visual
     record but clicking it explains that the document is no longer viewable
     here instead of opening it. */
  const showsReferralForm = isEndorsedRow;
  const docDate = row.anecdotal?.observedAt ?? row.date;
  const files: FolderFile[] = showsReferralForm
    ? [
        {
          name: `GCForm-03_${docDate}`,
          tag: `Referral form • ${timeAgo(docDate)}`,
          tone: categoryTone,
          icon: "doc",
        },
      ]
    : row.anecdotalId
      ? [
          {
            name: `OCForm-01_${docDate}`,
            tag: `Anecdotal • ${timeAgo(docDate)}`,
            tone: categoryTone,
            icon: "doc",
          },
        ]
      : [];

  function openFile() {
    /* Endorsed / finished cases stay clickable but never open the document:
       the folder explains where the record went instead. */
    if (isEndorsedRow) {
      onEndorsedNotice(row.student);
      return;
    }
    if (row.status === "resolved" || row.status === "dismissed") {
      onPrivacy(row.student);
      return;
    }
    if (!row.anecdotalId) return;
    onPreview(row.anecdotalId);
  }

  return (
    <article
      id={`nurse-case-${row.id}`}
      role="listitem"
      className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-muted/60 p-2.5 transition-colors [font-family:var(--font-inter)] hover:border-primary/60 hover:shadow dark:bg-muted/20 ${
        highlighted
          ? "border-amber-400 ring-2 ring-amber-400/40"
          : "border-border"
      }`}
    >
      <header className="-mx-2.5 flex min-w-0 items-center justify-between gap-1.5 border-b border-border px-3.5 pb-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <FileText
            size={14}
            aria-hidden
            style={{ color: categoryColor ?? "var(--muted-foreground)" }}
          />
          <span className="truncate capitalize">{title}</span>
        </span>
        <Pill
          tone={STAGE_TONE[stage.variant] ?? "neutral"}
          label="Case status"
          className="shrink-0"
        >
          {stage.label}
        </Pill>
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-2.5 shadow-sm dark:bg-card">
        <span className="flex min-w-0 items-center gap-1.5">
          <StudentMascot
            name={row.student}
            seed={row.lrn}
            character={row.mascot ?? undefined}
            size={28}
          />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[14px] font-semibold leading-tight">
              {row.student}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              {row.lrn && row.lrn !== "—" ? (
                <Pill label="LRN" className="tabular-nums">
                  {row.lrn}
                </Pill>
              ) : null}
              {row.section && row.section !== "—" ? (
                <Pill
                  tone="amber"
                  aria-label={`Section ${row.section}`}
                  label={row.grade && row.grade !== "—" ? row.grade : "Grade level"}
                  className="min-w-0 max-w-full overflow-hidden"
                >
                  <span className="truncate">{row.section}</span>
                </Pill>
              ) : null}
            </span>
          </span>
        </span>

        {statusHelp ? (
          <p className="m-0 text-[11px] leading-snug text-muted-foreground">
            {statusHelp}
          </p>
        ) : null}

        {files.length > 0 ? (
          <span className="flex w-full justify-start">
            <FolderCard
              folderColor={categoryColor}
              files={files}
              onFileClick={openFile}
              onCardClick={openFile}
              cardAriaLabel={
                isEndorsedRow
                  ? `Referral form for ${row.student} is no longer viewable — the case was endorsed`
                  : row.status === "resolved" || row.status === "dismissed"
                    ? `Report for ${row.student} is kept private because the case is finished`
                    : showsReferralForm
                      ? `Open the referral form for ${row.student}`
                      : `Open the anecdotal report (GCForm-01) for ${row.student}`
              }
            />
          </span>
        ) : null}

        {/* Folder caption as rectangle pills — case type, then date. */}
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Pill tone="blue" label="Referral type">
            {row.type}
          </Pill>
          {row.date && row.date !== "—" ? (
            <Pill label="Date referred">{formatDate(row.date)}</Pill>
          ) : null}
          {row.referredAt ? <Pill>{formatTime(row.referredAt)}</Pill> : null}
          {!isAdm && waiting ? (
            <Pill tone="red" label="Waiting time">
              {waiting}
            </Pill>
          ) : null}
        </span>

        {row.followUpDate || (!hidesSessionInfo && (cancelled || (!isAdm && booked))) ? (
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {row.followUpDate ? (
              <Pill label="Follow-up date">
                Follow-up {formatDate(row.followUpDate)}
              </Pill>
            ) : null}
            {!isAdm && !hidesSessionInfo && booked ? (
              <Pill tone="blue" label="Session status">
                Session booked
              </Pill>
            ) : null}
            {!hidesSessionInfo && cancelled ? (
              <Pill tone="red" label="Session status">
                Session cancelled
              </Pill>
            ) : null}
          </span>
        ) : null}

        {/* Detail blocks are icon buttons — hovering one floats its content
            as a kanban board beside the card (hover card, no page overlay).
            The sessions strip shares the row, exactly like the guidance card. */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex shrink-0 items-center gap-1.5">
            <DetailHover
              icon={<MessageSquareText size={14} aria-hidden />}
              ariaLabel={`Show the reason ${row.student} was referred`}
              boardTitle="Reason"
              description="Why this learner was referred to the clinic."
            >
              {row.reason}
            </DetailHover>

            {incident ? (
              <DetailHover
                icon={<Eye size={14} aria-hidden />}
                ariaLabel={`Show what was observed for ${row.student}`}
                boardTitle="What was observed"
                description="Recorded on the anecdotal report."
              >
                {incident}
              </DetailHover>
            ) : null}

            <DetailHover
              icon={<History size={14} aria-hidden />}
              ariaLabel={`Show the latest update on ${row.student}'s case`}
              boardTitle="Latest update"
              description="Most recent activity recorded on this case."
            >
              {latest.label}
              {latest.time && latest.time !== "—"
                ? ` — ${formatActionTime(latest.time)}`
                : ""}
            </DetailHover>

            {row.escalationReason ? (
              <DetailHover
                icon={<Send size={14} aria-hidden />}
                ariaLabel={`Show why ${row.student}'s case was escalated`}
                boardTitle="Escalated case"
                description="Why this case was sent to a higher office."
              >
                {row.escalationReason}
              </DetailHover>
            ) : null}
          </span>

          {row.sessions.length > 0 && !hidesSessionInfo ? (
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left transition-colors hover:border-primary/60 hover:bg-muted"
              aria-haspopup="dialog"
              aria-label={`Clinic sessions for ${row.student}, ${row.sessions.length} ${row.sessions.length === 1 ? "session" : "sessions"} — click to view`}
              onClick={() => onBoardChange(true)}
            >
              <CalendarClock
                size={14}
                className="shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                Clinic sessions
              </span>
              <span className="shrink-0 rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-secondary-foreground">
                {row.sessions.length}
              </span>
              <ChevronRight
                size={13}
                className="shrink-0 text-muted-foreground"
                aria-hidden
              />
            </button>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 pt-1">
          {booked && !isClosed && !isWithdrawn(row) ? (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              className="h-6 px-2 text-[11px]"
              onClick={() => {
                const scheduled = row.sessions.find(
                  (s) => s.status === "scheduled",
                );
                if (scheduled) onSession(row, scheduled, "move");
              }}
            >
              Reschedule session
            </Button>
          ) : null}
          {canReviewAdm || (!isAdm && !isClosed && !isWithdrawn(row)) ? (
            <Button
              type="button"
              size="xs"
              variant="default"
              className="h-6 px-2 text-[11px]"
              onClick={() =>
                canReviewAdm ? setReviewOpen(true) : setClinicReviewOpen(true)
              }
            >
              {isAdm ? "Review ADM case" : "Review clinic case"}
            </Button>
          ) : null}
          {/* Accepted clinic cases book their next session from the card —
              same action the one-per-row list offered. */}
          {!isAdm && !isPending && !isClosed && !booked && !done ? (
            <Button
              type="button"
              size="xs"
              variant="default"
              className="h-6 px-2 text-[11px]"
              onClick={() => onSchedule(row)}
            >
              <CalendarPlus size={12} aria-hidden />
              Book session
            </Button>
          ) : null}
        </div>
      </div>

      <NurseAdmReviewDialog
        row={row}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onChanged={onChanged}
        onCreateReferral={(draft) => onCreateReferral(row, draft)}
      />

      {!isAdm ? (
        <NurseStartHandlingDialog
          row={row}
          open={clinicReviewOpen}
          onClose={() => setClinicReviewOpen(false)}
          onChanged={onChanged}
        />
      ) : null}

      <Dialog open={boardOpen} onOpenChange={onBoardChange}>
        <DialogContent
          showCloseButton={false}
          className={`max-h-[85vh] overflow-y-auto shadow-none ${sessionBoardDialogWidth(row.sessions.length)}`}
        >
          {/* Title/description live on the kanban board below (the sr-only
              pair keeps the dialog labelled for screen readers). */}
          <DialogTitle className="sr-only">
            Clinic sessions for {row.student}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {row.sessions.length}{" "}
            {row.sessions.length === 1 ? "session" : "sessions"} on this case.
          </DialogDescription>
          <KanbanBoard
            title={`Clinic sessions for ${row.student}`}
            icon={<CalendarClock className="size-3.5" aria-hidden="true" />}
            actions={
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-6"
                  aria-label="Close"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </DialogClose>
            }
          >
            <SessionPlanCard
              title="Clinic sessions"
              sessions={row.sessions.map((s) => ({
                ...s,
                attachmentsCount: s.attachments?.length ?? 0,
              }))}
              now={now}
              closed={isClosed}
              closedHint="This case is closed — the sessions below are kept as history and can't be changed."
              emptyHint="No clinic sessions booked on this case."
              kindLabel={sessionKindLabel}
              docsSupported
              gateOnStart
              manageable={canManageSessions}
              // Scheduled rows keep only "Mark done" — reschedule/cancel live on
              // the case card, same as the guidance sessions board.
              hideScheduledActions
              onAction={(s, action) =>
                action === "docs" ? onDocs(row, s) : onSession(row, s, action)
              }
            />
          </KanbanBoard>
        </DialogContent>
      </Dialog>
    </article>
  );
}
