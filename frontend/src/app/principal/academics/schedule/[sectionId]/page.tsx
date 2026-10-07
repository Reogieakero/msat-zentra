"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ClipboardCheck, Clock, Coffee, Inbox, Info, Loader2, PanelRightClose, PanelRightOpen, Pencil, UserRound, Utensils } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { CardModal } from "@/components/ui/CardModal";
import { Textarea } from "@/components/ui/textarea";
import formStyles from "@/app/principal/academics/assign/components/form.module.css";
import { WEEK_LABELS_SHORT } from "@/app/teacher/classes/components/classes-data";
// Per-section review URL: /principal/academics/schedule/[sectionId]. Same
// shared ["principal-schedule-sections"] cache as the grid, so opening a
// section card is instant — mirroring teacher/schedule/[sectionId]. Layout
// mirrors the master-teacher setup view (ScheduleWeekSetup): plain header +
// weekly grid on the left, status + review + legend cards in the right rail.
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { PrincipalPageHeader } from "../../../components/PrincipalPageHeader";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import {
  buildTimetable,
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";

const DAYS = [1, 2, 3, 4, 5];

interface SubmissionEntry {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  teacherName: { id: string; name: string } | null;
  submittedAt: string | null;
  submitter: { fullName: string } | null;
}

interface Submission {
  id: string;
  name: string;
  gradeLevel: string;
  adviser: { fullName: string } | null;
  timetableEntries: SubmissionEntry[];
}

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function LoadingShell() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5" aria-busy="true" aria-label="Loading schedule">
      <div className="h-8 w-56 rounded bg-muted" />
      <div className="h-72 rounded-lg border bg-muted/40" />
    </section>
  );
}

export default function PrincipalSectionSchedulePage() {
  const params = useParams<{ sectionId: string }>();
  const sectionId = params.sectionId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Which decision is in flight — only that button shows a spinner, so the
  // other button never changes size or label while processing.
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  // Right-rail visibility (same pattern as the master-teacher setup view):
  // persisted per browser, effect-applied after mount so server and client
  // render the same first frame (no hydration mismatch).
  const [railOpen, setRailOpenState] = useState(true);
  useEffect(() => {
    const apply = () => {
      try {
        const stored = window.localStorage.getItem("zentra.principal-schedule-rail");
        if (stored === "open" || stored === "closed") {
          setRailOpenState((current) =>
            (current ? "open" : "closed") === stored ? current : stored === "open",
          );
        }
      } catch {
        // Private mode etc. — default holds for the visit.
      }
    };
    apply();
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, []);
  const setRailOpen = (next: boolean | ((v: boolean) => boolean)) => {
    setRailOpenState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      try {
        window.localStorage.setItem("zentra.principal-schedule-rail", value ? "open" : "closed");
      } catch {
        // Private mode etc. — choice holds for the visit.
      }
      return value;
    });
  };

  // Shared cache with the grid (instant from cache, no second network).
  // select narrows to this section so unrelated section updates don't rerender.
  const sectionsQuery = useQuery<{ sections: Submission[] }, unknown, Submission | null>({
    queryKey: ["principal-schedule-sections"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: Submission[] }>(
        "/api/academics/schedule/sections",
      );
      return data;
    },
    select: (d) => d.sections.find((s) => s.id === sectionId) ?? null,
    staleTime: 30_000,
  });
  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["principal-schedule-config"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>("/api/teacher/schedule/config");
      return data;
    },
  });

  const submission = sectionsQuery.data ?? null;

  const review = useMutation({
    mutationFn: async (vars: { decision: "approve" | "reject"; note?: string }) => {
      const { data } = await apiClient.post("/api/academics/schedule/review", {
        sectionId,
        decision: vars.decision,
        note: vars.note,
      });
      return data as { approved?: number; rejected?: number };
    },
    onSuccess: (data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["principal-schedule-sections"] });
      const name = submission?.name ?? "Section";
      if (vars.decision === "approve") {
        toast.success({
          title: "Schedule approved",
          description: `${data.approved ?? 0} slots for ${name} are now official.`,
        });
      } else {
        toast.success({
          title: "Sent back for revision",
          description: `${name} returned to draft with your note.`,
        });
      }
      router.push("/principal/academics/schedule");
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Failed to record decision.");
      setPendingAction(null);
      setFormError(message);
      toast.error({ title: "Could not record decision", description: message });
    },
  });

  if (sectionsQuery.isPending || configQuery.isPending) {
    return <LoadingShell />;
  }

  if (sectionsQuery.isError || !sectionsQuery.data) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <p role="alert" className="text-sm text-destructive">Could not load schedule.</p>
      </section>
    );
  }

  if (!submission) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <PrincipalPageHeader
          title="Section not found"
          description="This section does not exist or is outside grades 7–10."
        />
        <div>
          <Link
            href="/principal/academics/schedule"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to sections
          </Link>
        </div>
      </section>
    );
  }

  const config = configQuery.data?.config ?? null;
  const rows = config ? buildTimetable(config) : [];
  // Same cell lookup as the teacher grid: `${day}:${period}` → entry.
  const entryByKey = new Map(
    submission.timetableEntries.map((e) => [`${e.day}:${e.period}`, e]),
  );

  const submittedCount = submission.timetableEntries.filter((e) => e.status === "SUBMITTED").length;

  const handleReview = (decision: "approve" | "reject") => {
    if (review.isPending) return;
    if (decision === "reject" && !note.trim()) {
      setFormError("A revision note is required to send a schedule back.");
      return;
    }
    setFormError(null);
    setPendingAction(decision);
    review.mutate({ decision, note: note.trim() || undefined });
  };

  // Per-button busy flags — the label text never changes while processing,
  // only a spinner is added to the clicked button, so neither button
  // extends or shifts layout mid-flight.
  const rejecting = review.isPending && pendingAction === "reject";
  const approving = review.isPending && pendingAction === "approve";

  const statusVariant =
    submittedCount > 0
      ? "blue"
      : submission.timetableEntries.length === 0
        ? "gray"
        : submission.timetableEntries.every((e) => e.status === "APPROVED")
          ? "green"
          : "red";
  const statusMeta = {
    blue: {
      title: "Submitted",
      message: `${submittedCount} slot${submittedCount === 1 ? "" : "s"} awaiting your review.`,
      from: "#3b82f6",
      to: "#2563d1",
      chip: "bg-blue-500/15",
      icon: "text-blue-500",
      Icon: Clock,
    },
    green: {
      title: "Approved",
      message: "Official schedule.",
      from: "#22c55e",
      to: "#16a34a",
      chip: "bg-green-500/15",
      icon: "text-green-500",
      Icon: Check,
    },
    red: {
      title: "Draft",
      message: "Not yet submitted for review.",
      from: "#ef4444",
      to: "#dc2626",
      chip: "bg-red-500/15",
      icon: "text-red-500",
      Icon: Pencil,
    },
    gray: {
      title: "Empty",
      message: "No timetable yet.",
      from: "#9ca3af",
      to: "#6b7280",
      chip: "bg-gray-500/15",
      icon: "text-gray-500",
      Icon: Inbox,
    },
  }[statusVariant];
  const StatusIcon = statusMeta.Icon;

  return (
    <section className="flex w-full flex-col gap-5">
      <div
        className={`grid items-start gap-4 transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none ${
          railOpen ? "lg:grid-cols-[minmax(0,1fr)_17rem]" : "lg:grid-cols-[minmax(0,1fr)_0rem]"
        }`}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
              <Link href="/principal/academics/schedule">
                <ArrowLeft size={16} aria-hidden />
                Sections
              </Link>
            </Button>
            <PrincipalPageHeader
              title={`Schedule for ${submission.name}`}
              description={
                <>
                  {submission.gradeLevel}
                  {submission.adviser?.fullName
                    ? ` · Adviser: ${submission.adviser.fullName}`
                    : ""}
                  {` · ${submission.timetableEntries.length} slot${submission.timetableEntries.length === 1 ? "" : "s"}.`}
                </>
              }
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRailOpen((v) => !v)}
                  aria-label={railOpen ? "Hide sidebar" : "Show sidebar"}
                  title={railOpen ? "Hide sidebar" : "Show sidebar"}
                  aria-expanded={railOpen}
                >
                  {railOpen ? (
                    <PanelRightClose size={16} aria-hidden />
                  ) : (
                    <PanelRightOpen size={16} aria-hidden />
                  )}
                </Button>
              }
            />
          </div>

          {/* Weekly grid — identical framing to the master-teacher setup view
              (ScheduleWeekSetup): Time gutter + Mon–Fri columns, lunch/recess
              rows, filled cells with subject + teacher and a status dot.
              Read-only here. */}
          {config ? (
            <div className={`overflow-x-auto rounded-lg border ${emptyStyles.noScrollbar}`}>
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="w-28 p-2 text-left">
                      <span className="sr-only">Time</span>
                    </th>
                    {DAYS.map((day) => (
                      <th key={day} scope="col" className="p-2 text-center text-xs font-semibold">
                        {WEEK_LABELS_SHORT[day - 1]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => {
                    if (row.kind !== "period") {
                      const isLunch = row.kind === "lunch";
                      return (
                        <tr key={`break-${ri}`}>
                          <td
                            colSpan={DAYS.length + 1}
                            className="border-t bg-muted/40 px-2 py-1 text-center text-xs text-muted-foreground"
                          >
                            {isLunch ? (
                              <>
                                <Utensils size={12} className="mr-1 inline" aria-hidden />
                                Lunch Break · {formatRange(row.startMin, row.endMin)}
                              </>
                            ) : (
                              <>
                                <Coffee size={12} className="mr-1 inline" aria-hidden /> {row.label} ·{" "}
                                {formatRange(row.startMin, row.endMin)}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={`period-${row.periodIndex}`}>
                        <th
                          scope="row"
                          className="border-t p-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"
                        >
                          {formatRange(row.startMin, row.endMin)}
                        </th>
                        {DAYS.map((day) => {
                          const entry = entryByKey.get(`${day}:${row.periodIndex}`) ?? null;
                          const timeLabel = `${WEEK_LABELS_SHORT[day - 1]} ${formatRange(row.startMin, row.endMin)}`;
                          if (!entry) {
                            return (
                              <td key={day} className="border-t p-1">
                                <div
                                  aria-label={`${timeLabel}, empty`}
                                  title="Empty slot"
                                  className="flex min-h-14 w-full items-center justify-center rounded-md border border-dashed border-input px-1 text-center text-xs text-muted-foreground"
                                >
                                  <span aria-hidden="true">—</span>
                                </div>
                              </td>
                            );
                          }
                          const statusName =
                            entry.status === "APPROVED"
                              ? "approved"
                              : entry.status === "SUBMITTED"
                                ? "submitted"
                                : "draft";
                          const dotClass =
                            entry.status === "APPROVED"
                              ? "bg-green-500"
                              : entry.status === "SUBMITTED"
                                ? "bg-blue-500"
                                : "bg-red-500";
                          const label = `${timeLabel}, ${entry.subject.name}${entry.teacherName ? ` with ${entry.teacherName.name}` : ""} (${statusName})`;
                          return (
                            <td key={day} className="border-t p-1">
                              <div className="relative">
                                <div
                                  aria-label={label}
                                  title={`${entry.subject.name}${entry.teacherName ? ` — ${entry.teacherName.name}` : ""} (${statusName})`}
                                  className="flex min-h-14 w-full items-center justify-center rounded-md border border-solid bg-primary/5 px-1 py-1 text-center text-xs transition-colors"
                                >
                                  <span className="flex min-w-0 max-w-full flex-col items-center leading-tight">
                                    <span className="w-full truncate font-medium">
                                      {entry.subject.name}
                                    </span>
                                    {entry.teacherName ? (
                                      <span className="w-full truncate text-[11px] font-normal text-muted-foreground">
                                        {entry.teacherName.name}
                                      </span>
                                    ) : null}
                                  </span>
                                </div>
                                <span
                                  aria-hidden="true"
                                  title={statusName}
                                  className={`absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full ${dotClass}`}
                                />
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              Could not load timetable times — approve by slot count instead, or try again later.
            </p>
          )}
        </div>

        {/* Right rail — same card pattern as the teacher setup view.
            Collapsible via the header sidebar icon; hidden content is inert
            so it is skipped by keyboard and assistive tech. */}
        <div className="min-w-0 overflow-hidden" inert={!railOpen}>
          <div
            className={`flex w-full flex-col gap-4 transition-all duration-300 ease-out motion-reduce:transition-none lg:w-[17rem] lg:max-w-[17rem] ${
              railOpen
                ? "translate-x-0 opacity-100"
                : "pointer-events-none opacity-0 lg:translate-x-6"
            }`}
          >
          <div
            className={assign.card}
            aria-label={`Section adviser for ${submission.name}`}
          >
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
                aria-hidden="true"
              >
                <UserRound size={20} className="text-primary" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">Adviser</h3>
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={submission.adviser?.fullName ?? "No adviser assigned"}
                >
                  {submission.adviser ? submission.adviser.fullName : "No adviser assigned"}
                </p>
              </div>
            </div>
          </div>

          <div
            className={assign.card}
            role="status"
            aria-label={`Schedule status: ${statusMeta.title} — ${statusMeta.message}`}
            style={{
              borderColor: `color-mix(in oklch, ${statusMeta.from} 45%, transparent)`,
              background: `linear-gradient(135deg, color-mix(in oklch, ${statusMeta.from} 26%, var(--card)), color-mix(in oklch, ${statusMeta.to} 18%, var(--card)))`,
            }}
          >
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex items-center gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${statusMeta.chip}`}
                aria-hidden="true"
              >
                <StatusIcon size={20} className={statusMeta.icon} />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">{statusMeta.title}</h3>
                <p className="text-xs text-muted-foreground">{statusMeta.message}</p>
              </div>
            </div>
          </div>

          {submittedCount > 0 ? (
            <div className={assign.card} aria-label={`Review schedule for ${submission.name}`}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
                  aria-hidden="true"
                >
                  <ClipboardCheck size={20} className="text-primary" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">Review</h3>
                  <p className="text-xs text-muted-foreground">
                    Approve or send back with a note.
                  </p>
                </div>
              </div>
              <div className="relative flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setReviewOpen(true);
                  }}
                  aria-haspopup="dialog"
                  className={`flex min-h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors hover:border-primary ${note ? "text-foreground" : "text-muted-foreground"}`}
                >
                  <span className="truncate">
                    {note ? note : "Revision note (required to send back)…"}
                  </span>
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleReview("reject")}
                    disabled={review.isPending}
                    aria-busy={rejecting || undefined}
                    className="flex-1"
                  >
                    {rejecting ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                    ) : null}
                    <span aria-live="polite">Reject</span>
                  </Button>
                  <Button
                    onClick={() => handleReview("approve")}
                    disabled={review.isPending}
                    aria-busy={approving || undefined}
                    className="flex-1"
                  >
                    {approving ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                    ) : null}
                    <span aria-live="polite">Approve</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className={assign.card} aria-label="Slot status legend">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
                aria-hidden="true"
              >
                <Info size={20} className="text-primary" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">Legend</h3>
                <p className="text-xs text-muted-foreground">
                  What each slot dot means.
                </p>
              </div>
            </div>
            <div className="relative flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
                Draft — not yet submitted
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
                Submitted — awaiting your review
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
                Approved — official
              </span>
            </div>
          </div>
          </div>
        </div>
      </div>
      <CardModal
        open={reviewOpen}
        onClose={() => {
          if (review.isPending) return;
          setReviewOpen(false);
          setFormError(null);
        }}
        size="sm"
        title={`Review schedule for ${submission?.name ?? "section"}`}
        description="Approve the timetable or send it back to the master teacher with a revision note."
        dismissable={!review.isPending}
        watchKey={sectionId}
      >
        <Textarea
          autoFocus
          rows={4}
          placeholder="Revision note (required to send back)…"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setFormError(null);
          }}
          aria-label={`Revision note for ${submission?.name ?? "section"}`}
        />
        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
        <div className={formStyles.dialogFooter}>
          <Button
            variant="destructive"
            onClick={() => handleReview("reject")}
            disabled={review.isPending}
            aria-busy={rejecting || undefined}
          >
            {rejecting ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : null}
            <span aria-live="polite">Reject</span>
          </Button>
          <Button
            onClick={() => handleReview("approve")}
            disabled={review.isPending}
            aria-busy={approving || undefined}
          >
            {approving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : null}
            <span aria-live="polite">Approve</span>
          </Button>
        </div>
      </CardModal>
    </section>
  );
}
