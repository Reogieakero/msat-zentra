"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
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
  hasScheduledSession,
  isEndorsed,
  isWithdrawn,
  latestActionOf,
  latestSessionOf,
  rowStatusHelp,
  sessionKindLabel,
  timeAgo,
} from "./nurse-referrals-format";

/* Same pill recipe as the anecdotal shared folder card (student = amber,
   meta = secondary) — the ADM board reuses the identical language. */
const PILL_NAME =
  "inline-flex max-w-full items-center truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold leading-tight text-amber-700 dark:text-amber-400";
const PILL_META =
  "inline-flex max-w-full items-center truncate rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium leading-tight text-secondary-foreground";
const PILL_SOFT =
  "inline-flex max-w-full items-center truncate rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium leading-tight text-foreground";

/* Session state reads at a glance — booked = blue, cancelled = red (same
   tone recipe as the anecdotal category pills). */
const PILL_BOOKED =
  "inline-flex max-w-full items-center truncate rounded-md border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium leading-tight text-blue-700 dark:bg-blue-500/20 dark:text-blue-400";
const PILL_CANCELLED =
  "inline-flex max-w-full items-center truncate rounded-md border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[11px] font-medium leading-tight text-red-700 dark:bg-red-500/20 dark:text-red-400";

/* Stage badge border — matches each stage tone so the header pill reads like
   the other coloured pills on the card. */
const STAGE_BORDER: Record<string, string> = {
  amber: "border-amber-500/40",
  blue: "border-blue-500/40",
  green: "border-green-500/40",
  violet: "border-violet-500/40",
  red: "border-red-500/40",
  outline: "border-border",
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
  onSession,
  onDocs,
  onSchedule,
  onCreateReferral,
  onViewForm,
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
  onSession: (
    row: NurseQueueRow,
    session: NurseSessionItem,
    kind: SessionDialogKind,
  ) => void;
  onDocs: (row: NurseQueueRow, session: NurseSessionItem) => void;
  onSchedule: (row: NurseQueueRow) => void;
  onCreateReferral: (row: NurseQueueRow, draft: AdmReviewDraft) => void;
  onViewForm: (row: NurseQueueRow) => void;
  onChanged: () => void;
}) {
  const row = alert.row;
  const isAdm = row.type === "ADM";
  const isPending = row.status === "pending";
  const isClosed =
    row.status === "resolved" ||
    row.status === "dismissed" ||
    (row.completedSessions > 0 && !hasScheduledSession(row.sessions));
  const isEndorsedRow = isEndorsed(row.type, row.status);
  /* ADM cases stay reviewable until they are cancelled or rejected. */
  const canReviewAdm = isAdm && !isWithdrawn(row) && row.status !== "dismissed";
  const canManageSessions = !isAdm || (isAdm && row.status === "pending");
  const booked = hasScheduledSession(row.sessions);
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
  const metaLine = `${row.section}${row.grade && row.grade !== "—" ? ` · ${row.grade}` : ""}`;
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
     shows no document. Clicking the folder or its file opens that document's
     official preview overlay. */
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
    if (showsReferralForm) {
      onViewForm(row);
      return;
    }
    if (!row.anecdotalId) return;
    /* Only truly finished cases hide the report behind the privacy notice — a
       case that merely has a completed session is still open here (it may be
       waiting for endorsement), so it overlays its GCForm-01 record. */
    if (row.status === "resolved" || row.status === "dismissed") {
      onPrivacy(row.student);
      return;
    }
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
          <span className="truncate">{title}</span>
        </span>
        <Badge
          variant={stage.variant}
          className={`shrink-0 rounded-md ${STAGE_BORDER[stage.variant]}`}
        >
          {stage.label}
        </Badge>
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-2.5 shadow-sm dark:bg-card">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <StudentMascot
            name={row.student}
            seed={row.lrn}
            character={row.mascot ?? undefined}
            size={28}
          />
          <span className={PILL_NAME} title={row.student}>
            {row.student}
          </span>
          <span className={PILL_META} title={metaLine}>
            {metaLine}
          </span>
          {row.lrn && row.lrn !== "—" ? (
            <span className={PILL_META} title={`LRN ${row.lrn}`}>
              ID {row.lrn}
            </span>
          ) : null}
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
                showsReferralForm
                  ? `Open the referral form for ${row.student}`
                  : `Open the anecdotal report (GCForm-01) for ${row.student}`
              }
            />
          </span>
        ) : null}

        {/* Folder caption as rectangle pills — case type, then date. */}
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={PILL_META}>{row.type}</span>
          {row.date && row.date !== "—" ? (
            <span className={PILL_META}>{formatDate(row.date)}</span>
          ) : null}
        </span>

        {waiting || row.followUpDate || booked || cancelled ? (
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {waiting ? <span className={PILL_SOFT}>{waiting}</span> : null}
            {row.followUpDate ? (
              <span className={PILL_SOFT}>
                Follow-up {formatDate(row.followUpDate)}
              </span>
            ) : null}
            {booked ? <span className={PILL_BOOKED}>Session booked</span> : null}
            {cancelled ? (
              <span className={PILL_CANCELLED}>Session cancelled</span>
            ) : null}
          </span>
        ) : null}

        {/* Detail blocks are icon buttons — hovering one floats its content
            as a kanban board beside the card (hover card, no page overlay). */}
        <span className="flex min-w-0 items-center gap-1.5">
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
              ariaLabel={`Show why ${row.student}'s case was sent to the clinic`}
              boardTitle="Sent to the clinic"
              description="Why this case was escalated to the clinic for care."
            >
              {row.escalationReason}
            </DetailHover>
          ) : null}
        </span>

        {row.sessions.length > 0 ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left transition-colors hover:border-primary/60 hover:bg-muted"
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

        <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 pt-0.5">
          {canReviewAdm || (!isAdm && isPending) ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              onClick={() =>
                isAdm ? setReviewOpen(true) : setClinicReviewOpen(true)
              }
            >
              {isAdm ? "Review ADM case" : "Review clinic case"}
            </Button>
          ) : null}
          {/* Accepted clinic cases book their next session from the card —
              same action the one-per-row list offered. */}
          {!isAdm && !isPending && !isClosed && !booked ? (
            <Button
              type="button"
              size="xs"
              variant="default"
              className="h-6 px-2 text-[11px]"
              onClick={() => onSchedule(row)}
            >
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
          className={`max-h-[85vh] overflow-y-auto ${sessionBoardDialogWidth(row.sessions.length)}`}
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
            className="bg-card"
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
