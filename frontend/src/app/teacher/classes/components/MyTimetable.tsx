"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTerm } from "@/lib/term/TermContext";
import { useSheetContext } from "@/services/teacher/attendance.service";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import { CardModal } from "@/components/ui/CardModal";
import {
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import { getErrorMessage } from "./get-error-message";
import { buildTimetableReminder, getReminderMeta } from "./my-timetable-reminder";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { TeacherCodeClaim } from "@/components/schedule/TeacherCodeClaim";
import { TermAccessCard } from "@/components/schedule/TermAccessCard";
import { NoTermRecordsPanel } from "@/components/schedule/NoTermRecordsPanel";
import { MyWeekGrid } from "./MyWeekGrid";
import { ZentraPageHeaderSkeleton, ZentraFilterBarSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { TimetableSidebar, type LinkedName } from "./timetable-sidebar";
import { useSession } from "@/lib/auth/useSession";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";

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
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);
  const { activeTerm } = useTerm();
  const termLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "this term";
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;

  const [attCode, setAttCode] = useState("");
  const [attCodeError, setAttCodeError] = useState<string | null>(null);
  const [showCodeVerify, setShowCodeVerify] = useState(false);

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

  const session = useSession();
  const overview = useTeacherOverview();
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher =
    overview.data?.isMasterTeacher ?? meQuery.data?.isMasterTeacher ?? cachedMaster;

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
        <ZentraPageHeaderSkeleton />
        <ZentraFilterBarSkeleton selects={1} />
        <ZentraTableSkeleton rows={8} columns={4} />
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
      <div aria-label="Link teacher code">
        <TeacherCodeClaim
          title="Link your teacher code"
          description="Enter the code next to your name in the master teacher's teacher list (e.g. MS-101). Your assigned subjects and their timeslots will attach to this calendar."
        />
      </div>
    );
  }

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
            isMasterTeacher={isMasterTeacher}
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
        <TimetableSidebar
          linked={linked}
          isMasterTeacher={isMasterTeacher}
          reminder={reminder}
          reminderMeta={reminderMeta}
          onReleaseRequest={() => setConfirmReleaseOpen(true)}
        />
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
