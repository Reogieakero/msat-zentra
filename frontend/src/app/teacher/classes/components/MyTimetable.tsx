"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarDays, Check, Clock, Info, KeyRound, Loader2, UserRound } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTerm } from "@/lib/term/TermContext";
import { useSheetContext } from "@/services/teacher/attendance.service";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import { CardModal } from "@/components/ui/CardModal";
import {
  buildTimetable,
  formatClock,
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { TeacherCodeClaim } from "@/components/schedule/TeacherCodeClaim";
import { TermAccessCard } from "@/components/schedule/TermAccessCard";
import { NoTermRecordsPanel } from "@/components/schedule/NoTermRecordsPanel";
import { MyWeekGrid } from "./MyWeekGrid";
import { useSession } from "@/lib/auth/useSession";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";

interface LinkedName {
  id: string;
  name: string;
  code: string | null;
}

/** This term's verification grant (DB-saved auth flow per term). Null means
 *  the term hasn't been entered yet — Term 1 state never opens Term 2. */
interface TermGrant {
  via: string;
  attendanceVerified: boolean;
}

interface MySlot {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; gradeLevel: string };
  teacherName: { id: string; name: string; code: string | null } | null;
}

function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/* My Classes timetable — the teacher enters the code from their teacher-list
   entry once, linking their login to that catalog row. Every term then asks
   first (adviser tap-through or the same link code re-entered) and records a
   DB grant row for that term before the calendar opens — never straight to
   the pages. From then on the calendar renders their real assigned subjects
   and timeslots (committed slots only) instead of placeholder data. */
export function MyTimetable() {
  const queryClient = useQueryClient();
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);
  const { activeTerm } = useTerm();
  const termLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "this term";
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  // NOTE (Rules of Hooks): all state lives up here — nothing may hook
  // below the early returns further down.
  const [attCode, setAttCode] = useState("");
  const [attCodeError, setAttCodeError] = useState<string | null>(null);
  const [showCodeVerify, setShowCodeVerify] = useState(false);
  // Live clock for the reminder card — re-evaluates the current class
  // every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const meQuery = useQuery<{ teacherName: LinkedName | null; termGrant: TermGrant | null; isMasterTeacher?: boolean }>({
    queryKey: ["teacher-schedule-me", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        teacherName: LinkedName | null;
        termGrant: TermGrant | null;
        isMasterTeacher?: boolean;
      }>("/api/teacher/schedule/teachers/me");
      return data;
    },
  });

  const linked = meQuery.data?.teacherName ?? null;
  const termGrant = meQuery.data?.termGrant ?? null;

  // Currently designated Master Teacher bypasses every code gate on this
  // page — student and subject records open directly, no link/term code.
  const session = useSession();
  const overview = useTeacherOverview();
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher =
    overview.data?.isMasterTeacher ?? meQuery.data?.isMasterTeacher ?? cachedMaster;

  // Advisory identity for this login (shared roster cache): answers the
  // per-term "adviser or not" question without an extra endpoint.
  const sheetContext = useSheetContext();
  const isAdviser = !!sheetContext.data;

  const slotsQuery = useQuery<{ slots: MySlot[] }>({
    queryKey: ["teacher-my-slots", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ slots: MySlot[] }>(
        "/api/teacher/schedule/my-slots",
      );
      return data;
    },
    enabled: linked !== null || isMasterTeacher,
  });

  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>("/api/teacher/schedule/config");
      return data;
    },
    enabled: linked !== null || isMasterTeacher,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-me"] });
    void queryClient.invalidateQueries({ queryKey: ["teacher-my-slots"] });
  };

  const release = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete("/api/teacher/schedule/teachers/me");
      return data;
    },
    onSuccess: () => {
      setConfirmReleaseOpen(false);
      refresh();
      toast.success({
        title: `Left ${termLabel}`,
        description: "Only this term's entry was cleared — your link and other terms are untouched.",
      });
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Failed to leave this term.");
      toast.error({ title: "Could not leave term", description: message });
    },
  });

  const verify = useMutation({
    mutationFn: async (teacherCode: string) => {
      const { data } = await apiClient.post(
        "/api/teacher/schedule/teachers/verify-attendance",
        { code: teacherCode },
      );
      return data;
    },
    onSuccess: () => {
      setAttCodeError(null);
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-me"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] });
      toast.success({
        title: "Term entered",
        description: `Your code matches — classes are now open for ${termLabel}.`,
      });
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Could not verify teacher code.");
      setAttCodeError(message);
      toast.error({ title: "Could not verify code", description: message });
    },
  });

  // Adviser tap-through: answer this term's entry question as the adviser.
  // One tap records the term grant in the DB — no code needed.
  const grantTap = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ termGrant: TermGrant }>(
        "/api/teacher/schedule/teachers/term-grant",
        {},
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-me"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] });
      toast.success({
        title: "Term entered",
        description: `Workspace open as adviser for ${termLabel}.`,
      });
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Could not enter term.");
      toast.error({ title: "Could not enter term", description: message });
    },
  });

  const handleVerify = () => {
    if (verify.isPending) return;
    if (!attCode.trim()) {
      setAttCodeError("Enter your teacher code to open this term.");
      return;
    }
    setAttCodeError(null);
    verify.mutate(attCode.trim());
  };

  if (meQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading classes">
        <div className="h-8 w-56 rounded bg-muted" />
        <div className="h-72 rounded-lg border bg-muted/40" />
      </div>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load your classes.
      </p>
    );
  }

  if (!linked && !isMasterTeacher) {
    return (
      <>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Classes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Link your teacher code to attach your timetable.
          </p>
        </div>
        <TeacherCodeClaim
          title="Link your teacher code"
          description="Enter the code next to your name in the master teacher's teacher list (e.g. MS-101). Your assigned subjects and their timeslots will attach to this calendar."
        />
      </>
    );
  }

  // Term entry: each term asks first — advisers tap through, everyone else
  // answers with their link code (same code re-entered per term). The pages
  // never open until this term's grant row exists in the database.
  // The currently designated Master Teacher skips both gates entirely.
  if (!termGrant && !isMasterTeacher) {
    return (
      <>
        <div className={emptyStyles.emptyWrap}>
          <div className={assign.card} style={{ width: "100%", maxWidth: "28rem" }}>
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex flex-col items-center text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
                <KeyRound size={32} className="text-primary" />
              </span>
              <h3 className="text-lg font-semibold">Enter {termLabel}</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {isAdviser
                  ? `You advise ${sheetContext.data?.sectionName ?? "a section"} — continue as adviser to open your classes for ${termLabel}, or verify with your teacher code instead.`
                  : `Enter the same teacher code you linked to open your classes for ${termLabel}. Codes never carry across terms.`}
              </p>
              <div className="mt-4 flex w-full flex-col gap-2">
                {isAdviser && !showCodeVerify ? (
                  <>
                    <Button onClick={() => grantTap.mutate()} disabled={grantTap.isPending}>
                      {grantTap.isPending ? (
                        <>
                          <Loader2 size={16} className="animate-spin" aria-hidden />
                          <span aria-live="polite">Entering…</span>
                        </>
                      ) : (
                        "Continue as adviser"
                      )}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCodeVerify(true)}>
                      Verify with teacher code instead
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      placeholder="Teacher code (e.g. MS-101)…"
                      value={attCode}
                      onChange={(e) => {
                        setAttCode(e.target.value);
                        setAttCodeError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleVerify();
                      }}
                      aria-label="Teacher code"
                      className="text-center uppercase"
                    />
                    {attCodeError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {attCodeError}
                      </p>
                    ) : null}
                    <Button onClick={handleVerify} disabled={verify.isPending}>
                      {verify.isPending ? (
                        <>
                          <Loader2 size={16} className="animate-spin" aria-hidden />
                          <span aria-live="polite">Verifying…</span>
                        </>
                      ) : (
                        "Verify code"
                      )}
                    </Button>
                    {isAdviser ? (
                      <Button variant="ghost" onClick={() => setShowCodeVerify(false)}>
                        Back to adviser entry
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // No code linked yet (a Master with no link — unlinked regular teachers
  // exit at the claim gate above): code input only. No page header, no
  // sidebar, no info panels.
  if (!linked) {
    return (
      <TermAccessCard
        linkedName={null}
        termLabel={termLabel}
        claimTitle="Link your teacher code"
        claimDescription="Enter the code next to your name in the master teacher's teacher list (e.g. MS-101). Your assigned subjects and their timeslots will attach to this calendar."
        successTitle="Term entered"
        successDescription={`Your code matches — classes are now open for ${termLabel}.`}
      />
    );
  }

  const loadingSlots = slotsQuery.isPending || configQuery.isPending;
  const slots = slotsQuery.data?.slots ?? [];
  const config = configQuery.data?.config ?? null;

  // No records this term: no header title — just the panel, centered in
  // the page (not top-center).
  if (!loadingSlots && !slotsQuery.isError && config && slots.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-10rem)] items-center justify-center">
        <div className="w-full max-w-3xl">
          <NoTermRecordsPanel
            termLabel={termLabel}
            isMasterTeacher={isMasterTeacher}
            teacherName={linked.name}
          />
        </div>
      </div>
    );
  }

  // Reminder: current class right now, else today's next class — resolved
  // against the real day-shape clock so it always matches the grid.
  const reminder = (() => {
    if (!config || slots.length === 0) return null;
    const dow = now.getDay(); // 0 = Sun … 6 = Sat
    if (dow < 1 || dow > 5) {
      return {
        variant: "gray" as const,
        title: "No classes today",
        message: "Enjoy the weekend — see you Monday.",
      };
    }
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const rows = buildTimetable(config);
    const timeOf = (period: number) => {
      const row = rows.find((r) => r.kind === "period" && r.periodIndex === period);
      return row && row.kind === "period" ? { start: row.startMin, end: row.endMin } : null;
    };
    const today = slots.flatMap((s) => {
      const t = timeOf(s.period);
      return t ? [{ slot: s, ...t }] : [];
    });
    const current = today.find((t) => nowMin >= t.start && nowMin < t.end);
    if (current) {
      return {
        variant: "amber" as const,
        title: "Now",
        message: `${current.slot.subject.name} · ${current.slot.section.name} · ends ${formatClock(current.end)}.`,
      };
    }
    const upcoming = today
      .filter((t) => t.start > nowMin)
      .sort((a, b) => a.start - b.start)[0];
    if (upcoming) {
      return {
        variant: "blue" as const,
        title: "Up next",
        message: `${upcoming.slot.subject.name} · ${upcoming.slot.section.name} · ${formatRange(upcoming.start, upcoming.end)}.`,
      };
    }
    return {
      variant: "green" as const,
      title: "Done for today",
      message: "No more classes scheduled today.",
    };
  })();

  const reminderMeta =
    reminder === null
      ? null
      : {
          amber: {
            from: "#f59e0b",
            to: "#d9770f",
            chip: "bg-amber-500/15",
            icon: "text-amber-500",
            Icon: BellRing,
          },
          blue: {
            from: "#3b82f6",
            to: "#2563d1",
            chip: "bg-blue-500/15",
            icon: "text-blue-500",
            Icon: Clock,
          },
          green: {
            from: "#22c55e",
            to: "#16a34a",
            chip: "bg-green-500/15",
            icon: "text-green-500",
            Icon: Check,
          },
          gray: {
            from: "#9ca3af",
            to: "#6b7280",
            chip: "bg-gray-500/15",
            icon: "text-gray-500",
            Icon: CalendarDays,
          },
        }[reminder.variant];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Classes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isMasterTeacher
            ? "Master Teacher — no code needed. Your student and subject records open directly."
            : "Your attached timetable for the week."}
        </p>
      </div>
      {loadingSlots ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading timetable">
          <div className="h-72 rounded-lg border bg-muted/40" />
        </div>
      ) : slotsQuery.isError || !config ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load your timetable slots.
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0">
            <MyWeekGrid slots={slots} config={config} />
          </div>
        <div className="flex min-w-0 flex-col gap-4">
          {linked ? (
          <div className={assign.card} aria-label={`Linked teacher code for ${linked.name}`}>
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
                <h3 className="truncate font-semibold" title={`Linked as ${linked.name}`}>
                  Linked as <span className="text-primary underline-offset-4 hover:underline">{linked.name}</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  {linked.code ? `${linked.code} · ` : ""}
                  Showing your scheduled subjects and timeslots.
                </p>
              </div>
            </div>
            <div className="relative">
              <Button
                variant="link"
                size="sm"
                onClick={() => setConfirmReleaseOpen(true)}
                className="h-auto p-0 text-xs text-destructive"
              >
                Leave this term
              </Button>
            </div>
          </div>
          ) : isMasterTeacher ? (
            <div className={assign.card} aria-label="Master Teacher access">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-col gap-1">
                <h3 className="font-semibold">Master Teacher — no code needed</h3>
                <p className="text-xs text-muted-foreground">
                  Your student and subject records open directly. Manage the teacher list and
                  timetables in the Schedule workspace.
                </p>
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
                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
                Submitted — awaiting principal
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
                Approved — official
              </span>
            </div>
          </div>

          {reminder && reminderMeta ? (
            <div
              className={assign.card}
              role="status"
              aria-label={`Class reminder: ${reminder.title} — ${reminder.message}`}
              style={{
                borderColor: `color-mix(in oklch, ${reminderMeta.from} 45%, transparent)`,
                background: `linear-gradient(135deg, color-mix(in oklch, ${reminderMeta.from} 26%, var(--card)), color-mix(in oklch, ${reminderMeta.to} 18%, var(--card)))`,
              }}
            >
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${reminderMeta.chip}`}
                  aria-hidden="true"
                >
                  <reminderMeta.Icon size={20} className={reminderMeta.icon} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">{reminder.title}</h3>
                  <p className="text-xs text-muted-foreground">{reminder.message}</p>
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      )}

      {confirmReleaseOpen && linked ? (
        <CardModal
          open
          onClose={() => setConfirmReleaseOpen(false)}
          dismissable={!release.isPending}
          size="sm"
          title={<>Leave {termLabel}?</>}
          description={
            <>
              This clears only this term&apos;s entry for {linked.name}
              {linked.code ? ` (${linked.code})` : ""} — your link and other
              terms stay attached. Re-enter your code any time to come back.
            </>
          }
        >
          <div className="flex justify-end gap-2">
            <Button variant="destructive" onClick={() => setConfirmReleaseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => release.mutate()}
              disabled={release.isPending}
              aria-busy={release.isPending || undefined}
            >
              {release.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span aria-live="polite">Leaving…</span>
                </>
              ) : (
                "Leave term"
              )}
            </Button>
          </div>
        </CardModal>
      ) : null}
    </div>
  );
}
