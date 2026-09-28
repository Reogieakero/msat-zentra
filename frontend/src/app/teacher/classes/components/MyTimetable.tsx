"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CalendarDays, Check, Clock, Info, Loader2, UserRound } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildTimetable,
  formatClock,
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { TeacherCodeClaim } from "@/components/schedule/TeacherCodeClaim";
import { MyWeekGrid } from "./MyWeekGrid";

interface LinkedName {
  id: string;
  name: string;
  code: string | null;
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
   entry once, linking their login to that catalog row. From then on the
   calendar renders their real assigned subjects and timeslots (committed
   slots only) instead of placeholder data. */
export function MyTimetable() {
  const queryClient = useQueryClient();
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);
  // Live clock for the reminder card — re-evaluates the current class
  // every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const meQuery = useQuery<{ teacherName: LinkedName | null }>({
    queryKey: ["teacher-schedule-me"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ teacherName: LinkedName | null }>(
        "/api/teacher/schedule/teachers/me",
      );
      return data;
    },
  });

  const linked = meQuery.data?.teacherName ?? null;

  const slotsQuery = useQuery<{ slots: MySlot[] }>({
    queryKey: ["teacher-my-slots"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ slots: MySlot[] }>(
        "/api/teacher/schedule/my-slots",
      );
      return data;
    },
    enabled: linked !== null,
  });

  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>("/api/teacher/schedule/config");
      return data;
    },
    enabled: linked !== null,
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
        title: "Teacher code unlinked",
        description: "Enter the correct code to link your classes again.",
      });
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Failed to unlink teacher code.");
      toast.error({ title: "Could not unlink code", description: message });
    },
  });

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

  if (!linked) {
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

  const loadingSlots = slotsQuery.isPending || configQuery.isPending;
  const slots = slotsQuery.data?.slots ?? [];
  const config = configQuery.data?.config ?? null;

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
          Your attached timetable for the week.
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          {loadingSlots ? (
            <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading timetable">
              <div className="h-72 rounded-lg border bg-muted/40" />
            </div>
          ) : slotsQuery.isError || !config ? (
            <p role="alert" className="text-sm text-destructive">
              Could not load your timetable slots.
            </p>
          ) : slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-12 text-center">
              <span className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
                <CalendarDays size={32} className="text-primary" />
              </span>
              <h3 className="text-lg font-semibold">No classes attached yet</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Your subjects and timeslots will appear here once the master teacher
                schedules {linked.name} and the slots are sent for review or approved.
              </p>
            </div>
          ) : (
            <MyWeekGrid slots={slots} config={config} />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
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
                Unlink
              </Button>
            </div>
          </div>

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

      {confirmReleaseOpen ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmReleaseOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Unlink teacher code?</DialogTitle>
              <DialogDescription>
                This detaches {linked.name}
                {linked.code ? ` (${linked.code})` : ""} from your login and clears this
                calendar. You can link a code again any time.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmReleaseOpen(false)}>
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
                    <span aria-live="polite">Unlinking…</span>
                  </>
                ) : (
                  "Unlink"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
