"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FolderCard, type FolderFile } from "@/components/ui/FolderCard";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
} from "lucide-react";
import { fetchOcForm01Detail, type OcForm01Detail } from "@/components/ocform01/ocform01";
import {
  buildGcForm03Data,
  consultRecommendation,
} from "@/services/guidance/gcform03.service";
import type { GcForm03Data } from "@/services/guidance/gcform03.types";
import { GcForm03PreviewDialog } from "../../adm/components/GcForm03PreviewDialog";
import type {
  CounselingSessionItem,
  GuidanceReferralItem,
} from "@/services/guidance/guidance.types";
import {
  anecdotalCategoryColor,
  formatActionTime,
  formatDate,
  hasScheduledSession,
  isEndorsed,
  isWithdrawn,
  latestActionOf,
  latestSessionOf,
  rowStatusHelp,
  rowStatusLabel,
  timeAgo,
} from "./guidance-referrals-format";
import { latestActionDay } from "./use-guidance-entry-meta";
import { GuidanceEntryDocsHost } from "./guidance-entry-docs-host";

/* Pill recipe (shape/palette) now comes from the shared ui/Pill; the board
   still pins the header stage badge to its per-stage border colour. */
const STAGE_BORDER: Record<string, string> = {
  amber: "border-amber-500/40",
  blue: "border-blue-500/40",
  green: "border-green-500/40",
  violet: "border-violet-500/40",
  red: "border-red-500/40",
  outline: "border-border",
};

const ICON_BTN =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted hover:text-foreground";

type StageVariant = "amber" | "blue" | "green" | "violet" | "red" | "outline";

function caseStage(row: GuidanceReferralItem): {
  label: string;
  variant: StageVariant;
} {
  const hasCompleted = row.sessions.some((s) => s.status === "completed");
  const hasScheduled = row.sessions.some((s) => s.status === "scheduled");

  if (isWithdrawn(row)) return { label: "Cancelled", variant: "red" };
  if (row.status === "dismissed") {
    return row.type === "ADM"
      ? { label: "Reject", variant: "red" }
      : { label: "Cancelled", variant: "red" };
  }
  if (row.status === "resolved") return { label: "Done", variant: "green" };
  if (row.status === "follow_up") return { label: "Follow-up", variant: "violet" };
  if (hasCompleted) return { label: "Done", variant: "green" };
  if (hasScheduled) return { label: "Booked session", variant: "blue" };
  if (row.status === "pending") return { label: "Needs review", variant: "amber" };
  if (isEndorsed(row.type, row.status)) {
    return { label: "Endorsed", variant: "green" };
  }
  if (row.status === "escalated") return { label: "Escalated", variant: "red" };
  return {
    label: rowStatusLabel(row.type, row.status, row),
    variant: "outline",
  };
}

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
    <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={200}>
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
 * Guidance case card — the same folder-card anatomy as the nurse ADM /
 * clinic boards (muted shell, header stage badge, white inner surface,
 * student pills, folder and hover detail boards). ADM cases review from
 * the card; pending counseling cases review through the accept dialog and
 * accepted ones book their next session. Sessions and the GCForm-03
 * referral form open from the card.
 */
export function GuidanceCaseKanbanCard({
  row,
  now,
  highlighted = false,
  actionPending,
  onReviewAdm,
  onReviewCounseling,
  onBookSession,
  onPreview,
  onPrivacy,
  onOpenSession,
  onChanged,
}: {
  row: GuidanceReferralItem;
  now: number;
  highlighted?: boolean;
  actionPending: boolean;
  onReviewAdm: (row: GuidanceReferralItem) => void;
  onReviewCounseling: (row: GuidanceReferralItem) => void;
  onBookSession: (row: GuidanceReferralItem) => void;
  onPreview: (recordId: string) => void;
  onPrivacy: (studentName: string) => void;
  onOpenSession: (
    referralId: string,
    session: CounselingSessionItem,
    dialog: "finish" | "move" | "cancelSess" | "deleteSess"
  ) => void;
  onChanged: () => void;
}) {
  const isAdm = row.type === "ADM";
  const isPending = row.status === "pending";
  const isClosed = row.status === "resolved" || row.status === "dismissed";
  const isEndorsedRow = isEndorsed(row.type, row.status);
  /* ADM cases stay reviewable until they are cancelled or rejected. */
  const canReview = isAdm && !isWithdrawn(row) && row.status !== "dismissed";
  /* Pending counseling cases review through the accept dialog, mirroring the
     nurse clinic board; accepted cases then book their next session here. */
  const canReviewCounseling = !isAdm && isPending;
  const canBook =
    !isAdm &&
    !isPending &&
    !isClosed &&
    !hasScheduledSession(row.sessions);
  const canManageSessions = !isAdm || isPending;
  const booked = hasScheduledSession(row.sessions);
  const cancelled = !booked && latestSessionOf(row.sessions)?.status === "cancelled";
  const latest = latestActionOf(row);
  const category =
    row.category?.trim() && row.category !== "—"
      ? row.category
      : isAdm
        ? "ADM case"
        : "Counseling case";
  const categoryColor = anecdotalCategoryColor(row.category);
  const categoryTone =
    ANECDOTAL_CATEGORY_TONES[(row.category ?? "").trim().toLowerCase()] ?? 1;
  const statusHelp = rowStatusHelp(row.type, row.status, row);
  const stage = caseStage(row);
  const incident = row.anecdotalExcerpt?.trim() || "";
  const docDate = row.date;

  const [sessOpen, setSessOpen] = React.useState(false);
  const [docsFor, setDocsFor] = React.useState<CounselingSessionItem | null>(null);

  const [gcOpen, setGcOpen] = React.useState(false);
  const [gcData, setGcData] = React.useState<GcForm03Data | null>(null);
  const [gcLoading, setGcLoading] = React.useState(false);

  async function openGcForm() {
    if (gcLoading) return;
    if (gcData) {
      setGcOpen(true);
      return;
    }
    setGcLoading(true);
    try {
      let report: OcForm01Detail | null = null;
      try {
        if (row.anecdotalId) report = await fetchOcForm01Detail(row.anecdotalId);
      } catch {
        report = null;
      }
      const data = buildGcForm03Data(row, report, consultRecommendation(row.notes));
      const day = latestActionDay(latest.time);
      if (day) {
        data.receivedDate = day;
        data.counselorDate = day;
      }
      setGcData(data);
      setGcOpen(true);
    } finally {
      setGcLoading(false);
    }
  }

  const showsReferralForm = isEndorsedRow;
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
      void openGcForm();
      return;
    }
    if (!row.anecdotalId) return;
    if (isClosed) {
      onPrivacy(row.student);
      return;
    }
    onPreview(row.anecdotalId);
  }

  return (
    <article
      id={`guidance-case-${row.id}`}
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
          <span className="truncate capitalize">{category}</span>
        </span>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={stage.variant}
                className={`shrink-0 rounded-md ${STAGE_BORDER[stage.variant]}`}
              >
                {stage.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              Case status
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg border bg-white p-2.5 shadow-sm dark:bg-card">
        <span className="flex min-w-0 items-center gap-1.5">
          <StudentMascot name={row.student} seed={row.lrn} size={28} />
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
                  label={row.grade || "Grade level"}
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
                showsReferralForm
                  ? `Open the referral form for ${row.student}`
                  : `Open the anecdotal report (GCForm-01) for ${row.student}`
              }
            />
          </span>
        ) : null}

        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Pill tone="blue" label="Referral type">
            {row.type}
          </Pill>
          {row.date && row.date !== "—" ? (
            <Pill label="Date referred">{formatDate(row.date)}</Pill>
          ) : null}
        </span>

        {row.followUpDate || booked || cancelled ? (
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {row.followUpDate ? (
              <Pill label="Follow-up date">
                Follow-up {formatDate(row.followUpDate)}
              </Pill>
            ) : null}
            {booked ? (
              <Pill tone="blue" label="Session status">
                Session booked
              </Pill>
            ) : null}
            {cancelled ? (
              <Pill tone="red" label="Session status">
                Session cancelled
              </Pill>
            ) : null}
          </span>
        ) : null}

        <span className="flex min-w-0 items-center gap-1.5">
          <DetailHover
            icon={<MessageSquareText size={14} aria-hidden />}
            ariaLabel={`Show the reason ${row.student} was referred`}
            boardTitle="Reason"
            description="Why this learner was referred to guidance."
          >
            {row.reason || "No reason recorded."}
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

        {row.sessions.length > 0 ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left transition-colors hover:border-primary/60 hover:bg-muted"
            aria-haspopup="dialog"
            aria-label={`Counseling sessions for ${row.student}, ${row.sessions.length} ${row.sessions.length === 1 ? "session" : "sessions"} — click to view`}
            onClick={() => setSessOpen(true)}
          >
            <CalendarClock
              size={14}
              className="shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">
              Counseling sessions
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
          {canReview ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={actionPending}
              onClick={() => onReviewAdm(row)}
            >
              Review ADM case
            </Button>
          ) : null}
          {canReviewCounseling ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={actionPending}
              onClick={() => onReviewCounseling(row)}
            >
              Review counseling case
            </Button>
          ) : null}
          {canBook ? (
            <button
              type="button"
              className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-blue-500/15 px-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400"
              disabled={actionPending}
              onClick={() => onBookSession(row)}
            >
              <CalendarPlus size={12} aria-hidden />
              Book session
            </button>
          ) : null}
        </div>
      </div>

      <GuidanceEntryDocsHost
        row={row}
        now={now}
        sessOpen={sessOpen}
        onSessOpenChange={setSessOpen}
        docsFor={docsFor}
        onDocs={setDocsFor}
        onDocsClose={() => setDocsFor(null)}
        onOpenSession={(referralId, session, dialog) => {
          setSessOpen(false);
          onOpenSession(referralId, session, dialog);
        }}
        actionPending={actionPending}
        onChanged={onChanged}
        isClosed={isClosed}
        canManageSessions={canManageSessions}
      />

      {gcOpen && gcData && (
        <GcForm03PreviewDialog
          open
          data={gcData}
          confirming={false}
          onClose={() => setGcOpen(false)}
          onConfirm={() => {}}
          viewOnly
        />
      )}
    </article>
  );
}
