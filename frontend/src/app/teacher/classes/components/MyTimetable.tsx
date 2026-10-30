"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTerm } from "@/lib/term/TermContext";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import { UnlinkCodeDialog } from "./UnlinkCodeDialog";
import { Pill } from "@/components/ui/pill";
import { useDock } from "@/components/dock/dock-store";
import {
  buildTimetable,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import { getErrorMessage } from "./get-error-message";
import { buildTimetableReminder, getReminderMeta } from "./my-timetable-reminder";
import kanbanStyles from "@/app/teacher/schedule/components/subject-kanban.module.css";
import advisoryKanban from "@/app/teacher/overview/components/advisory-schedule-kanban.module.css";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { TimetableSidebar, type LinkedName } from "./timetable-sidebar";
import { TeacherCodeClaim } from "@/components/schedule/TeacherCodeClaim";
import { TermAccessCard } from "@/components/schedule/TermAccessCard";
import { NoTermRecordsPanel } from "@/components/schedule/NoTermRecordsPanel";
import { MyWeekGrid } from "./MyWeekGrid";
import { Skeleton } from "@/components/ui/skeleton";

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

export function MyTimetable() {
  const queryClient = useQueryClient();
  const dock = useDock();
  const dockRef = useRef(dock);
  useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);
  // Unlink progress now lives in the single shared Dock.
  const unlinkTaskRef = useRef<string | null>(null);
  const { activeTerm } = useTerm();
  const termLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "this term";
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const [attCode, setAttCode] = useState("");
  const [attCodeError, setAttCodeError] = useState<string | null>(null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
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

  const slotsQuery = useQuery<{ slots: MySlot[] }>({
    queryKey: ["teacher-my-slots", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ slots: MySlot[] }>(
        "/api/teacher/schedule/my-slots",
      );
      return data;
    },
    enabled: linked !== null,
  });

  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>("/api/teacher/schedule/config");
      return data;
    },
    enabled: linked !== null,
  });

  const nowKey = useMemo(() => {
    const config = configQuery.data?.config ?? null;
    if (!config) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const dayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    const day = dayMap[get("weekday")] ?? 0;
    if (day < 1 || day > 5) return null;
    const mins = Number(get("hour")) * 60 + Number(get("minute"));
    const row = buildTimetable(config).find(
      (r) => r.kind === "period" && mins >= r.startMin && mins < r.endMin,
    );
    if (!row || row.kind !== "period") return null;
    return `${day}:${row.periodIndex}`;
  }, [configQuery.data?.config, now]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-me"] });
    void queryClient.invalidateQueries({ queryKey: ["teacher-my-slots"] });
    // Unlinking clears classes + grading + attendance together.
    void queryClient.invalidateQueries({ queryKey: ["teacher-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["teacher-overview-gradebook"] });
    void queryClient.invalidateQueries({ queryKey: ["teacher-overview-secondary"] });
    void queryClient.invalidateQueries({ queryKey: ["offered-subjects"] });
    void queryClient.invalidateQueries({ queryKey: ["attendance-sheet-marks"] });
    void queryClient.invalidateQueries({ queryKey: ["attendance-section-roster"] });
    void queryClient.invalidateQueries({ queryKey: ["teacher-grading-class"] });
  };

  const release = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete("/api/teacher/schedule/teachers/me");
      return data;
    },
    onSuccess: () => {
      const id = unlinkTaskRef.current;
      unlinkTaskRef.current = null;
      try {
        if (id) dockRef.current.completeTask(id, "Code unlinked · classes, grading, attendance cleared");
      } catch {
        /* ignore */
      }
      refresh();
      toast.success({
        title: "Code unlinked",
        description: "Your link code was removed — classes, grading, and attendance are now cleared.",
      });
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Failed to unlink code.");
      const id = unlinkTaskRef.current;
      unlinkTaskRef.current = null;
      try {
        if (id) dockRef.current.failTask(id, message);
      } catch {
        /* ignore */
      }
      toast.error({ title: "Could not unlink code", description: message });
    },
  });

  const handleUnlinkConfirm = () => {
    if (!linked || release.isPending) return;
    try {
      unlinkTaskRef.current = dockRef.current.startTask({ kind: "unlink-code", title: "Unlinking code", description: linked.code ? `Unlinking ${linked.code}…` : "Unlinking code…" });
    } catch {
      unlinkTaskRef.current = null;
    }
    setConfirmReleaseOpen(false);
    release.mutate();
  };

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
        <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="min-w-0">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="mt-1 h-5 w-64" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-2.5">
                  <Skeleton className="h-5 w-24 rounded-md" />
                  {[0, 1, 2].map((j) => (
                    <Skeleton key={j} className="h-24 rounded-lg" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
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

  // Every teacher — master included — must link a code first.
  if (!linked) {
    return (
      <>
        <div aria-label="Link teacher code">
          <TeacherCodeClaim
            title="Link your teacher code"
            description="Enter the code next to your name in the master teacher's teacher list (e.g. MS-101). Your assigned subjects and their timeslots will attach to this calendar."
          />
        </div>
      </>
    );
  }

  if (!termGrant) {
    return (
      <>
        <div className={emptyStyles.emptyWrap}>
          <div className={`${kanbanStyles.column} mx-auto w-full max-w-md`}>
            <KanbanBoard
              title="Enter"
              icon={
                <span className="text-amber-500" aria-hidden>
                  <KeyRound size={14} />
                </span>
              }
              actions={
                <span className="flex items-center gap-1.5">
                  {termLabel
                    .split("·")
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .map((part) => (
                      <Pill key={part} tone="amber" label="Term">
                        {part}
                      </Pill>
                    ))}
                </span>
              }
              description="Enter your teacher code to open your classes. Codes never carry across terms."
            >
              <div className="flex flex-col px-1 py-1">
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Input
                    placeholder="TEACHER CODE (E.G. MS-101)..."
                    value={attCode}
                    onChange={(e) => {
                      setAttCode(e.target.value);
                      setAttCodeError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleVerify();
                    }}
                    aria-label="Teacher code"
                    className="h-6 min-w-0 flex-1 rounded-lg text-center text-xs uppercase placeholder:text-[12px]"
                  />
                  <Button
                    onClick={handleVerify}
                    disabled={verify.isPending}
                    className="h-6 shrink-0 rounded-lg bg-black px-3 text-xs text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                  >
                    {verify.isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" aria-hidden />
                        <span aria-live="polite">Verifying…</span>
                      </>
                    ) : (
                      "Verify code"
                    )}
                  </Button>
                </div>
                {attCodeError ? (
                  <p role="alert" className="text-center text-sm text-destructive">
                    {attCodeError}
                  </p>
                ) : null}
              </div>
            </KanbanBoard>
          </div>
        </div>
      </>
    );
  }

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

  if (!loadingSlots && !slotsQuery.isError && config && slots.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-10rem)] items-center justify-center">
        <div className="w-full max-w-3xl">
          <NoTermRecordsPanel
            termLabel={termLabel}
            isMasterTeacher={false}
            teacherName={linked.name}
          />
        </div>
      </div>
    );
  }

  const reminder = buildTimetableReminder(config, slots, now);

  const reminderMeta = getReminderMeta(reminder);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">My Classes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your attached timetable for the week.
            </p>
          </div>
          {loadingSlots ? (
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
              aria-busy="true"
              aria-label="Loading timetable"
            >
              {[1, 2, 3, 4, 5].map((day, colIndex) => (
                <div
                  key={day}
                  className={`flex flex-col gap-2 rounded-xl border border-border p-2.5 ${advisoryKanban.skeletonColumn}`}
                  style={{ "--col-index": colIndex } as CSSProperties}
                >
                  <div className={`h-5 w-24 rounded-md bg-muted ${advisoryKanban.skeleton}`} />
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`h-24 rounded-lg bg-muted ${advisoryKanban.skeleton}`}
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : slotsQuery.isError || !config ? (
            <p role="alert" className="text-sm text-destructive">
              Could not load your timetable slots.
            </p>
          ) : (
            <div className="min-w-0">
              <MyWeekGrid slots={slots} config={config} nowKey={nowKey} />
            </div>
          )}
        </div>
        {!loadingSlots && !slotsQuery.isError && config ? (
          <TimetableSidebar
            linked={linked}
            reminder={reminder}
            reminderMeta={reminderMeta}
            onReleaseRequest={() => setConfirmReleaseOpen(true)}
          />
        ) : null}
      </div>

      {confirmReleaseOpen && linked ? (
        <UnlinkCodeDialog
          linked={linked}
          pending={release.isPending}
          onClose={() => {
            if (!release.isPending) setConfirmReleaseOpen(false);
          }}
          onConfirm={handleUnlinkConfirm}
        />
      ) : null}
    </div>
  );
}
