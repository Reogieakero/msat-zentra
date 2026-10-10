"use client";
import { useEffect, useMemo, useState } from "react";
import { useTopbarCrumb } from "@/app/teacher/layout";
import { useMutation, useQuery } from "@tanstack/react-query";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { useTeacherInvalidate } from "../components/use-teacher-invalidate";
import { apiClient } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { toast } from "@/components/ui/sonner";
import { AttendanceRosterTable } from "./components/AttendanceRosterTable";
import { ZentraPageHeaderSkeleton, ZentraFilterBarSkeleton, ZentraTableSkeleton } from "@/components/shared/zentra-skeletons/ZentraSkeletons";
import { AttendanceTermGate } from "./components/AttendanceTermGate";
import { SheetDatePicker } from "./components/sheet-date-picker";
import { VerifyCodeCard } from "./components/verify-code-card";
import { AttendanceSidebar } from "./components/attendance-sidebar";
import { useAttendancePairs, type LinkedName } from "./components/use-attendance-pairs";
import { useSlotCards } from "./components/use-slot-cards";
import {
  phTodayKey,
  useMeetupDates,
  useOfferedSubjects,
  useSectionRoster,
  useSheetContext,
} from "@/services/teacher/attendance.service";
import type { SheetContext } from "@/services/teacher/attendance.types";
import { TeacherCodeClaim } from "@/components/schedule/TeacherCodeClaim";
import { TermAccessCard } from "@/components/schedule/TermAccessCard";
import { NoTermRecordsPanel } from "@/components/schedule/NoTermRecordsPanel";
import { useSession } from "@/lib/auth/useSession";
import { useCachedMasterTeacher } from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useTerm } from "@/lib/term/TermContext";
import {
  buildTimetable,
  formatClock,
} from "@/app/teacher/schedule/components/schedule-time";
import type { AttendanceLive } from "./components/AttendanceRosterTable";
import styles from "./components/attendance-sheet.module.css";
interface TermGrant {
  via: string;
  attendanceVerified: boolean;
}
export default function TeacherAdvisoryAttendancePage() {
  const invalidateTeacher = useTeacherInvalidate();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const [date, setDate] = useState(phTodayKey);
  const [attCode, setAttCode] = useState("");
  const [attCodeError, setAttCodeError] = useState<string | null>(null);
  const [showCodeVerify, setShowCodeVerify] = useState(false);
  const { activeTerm } = useTerm();
  const termLabel = activeTerm
    ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}`
    : "this term";
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
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
  const { pairs, mySlotsQuery, configQuery } = useAttendancePairs(termKey, linked, isMasterTeacher);
  const sheetContext = useSheetContext();
  const isAdviser = !!sheetContext.data;
  const advisorySectionId = sheetContext.data?.sectionId ?? null;
  const verify = useMutation({
    mutationFn: async (teacherCode: string) => {
      const { data } = await apiClient.post<{
        verified: boolean;
        teacherName: { id: string };
      }>("/api/teacher/schedule/teachers/verify-attendance", {
        code: teacherCode,
      });
      return data;
    },
    onSuccess: (data) => {
      setAttCodeError(null);
      if (data?.teacherName?.id) markSelfNotified(data.teacherName.id);
      invalidateTeacher.schedule();
      toast.success({
        title: "Attendance unlocked",
        description: `Your code matches — per-subject sheets are now open for ${termLabel}.`,
      });
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, "Could not verify teacher code.");
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
      invalidateTeacher.schedule();
      toast.success({
        title: "Term entered",
        description: `Workspace open as adviser for ${termLabel}.`,
      });
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, "Could not verify teacher code.");
      toast.error({ title: "Could not enter term", description: message });
    },
  });
  const [pairKey, setPairKey] = useState<string | undefined>(undefined);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const selectedPair = pairs.find((p) => p.key === pairKey) ?? pairs[0];
  const resolvedSectionId = selectedPair?.section.id;
  const rosterQuery = useSectionRoster(resolvedSectionId);
  const rosterOverride: {
    ctx: SheetContext | null;
    pending: boolean;
    error: boolean;
    requestedSectionId: string | null;
  } = {
    ctx: rosterQuery.data
      ? {
          sectionId: rosterQuery.data.sectionId,
          sectionName: rosterQuery.data.sectionName,
          termId: rosterQuery.data.termId,
          students: rosterQuery.data.students,
        }
      : null,
    pending: rosterQuery.isPending,
    error: rosterQuery.isError,
    requestedSectionId: resolvedSectionId ?? null,
  };
  const offeredQuery = useOfferedSubjects(resolvedSectionId, rosterQuery.data?.termId);
  const offered = offeredQuery.data ?? [];
  const myOffered = offered.filter((s) => s.canMark && (s.isMine ?? true));
  const resolvedSubjectId =
    selectedPair?.subject?.id ??
    myOffered.find((s) => s.canMark)?.subjectId ??
    myOffered[0]?.subjectId ??
    offered.find((s) => s.canMark)?.subjectId ??
    offered[0]?.subjectId;
  const resolvedOffered = offered.find((s) => s.subjectId === resolvedSubjectId);
  const resolvedAssignmentId = resolvedOffered?.myAssignmentId ?? resolvedOffered?.assignmentId;
  const takenByOther =
    !!resolvedOffered && (resolvedOffered.takenByOther || ((resolvedOffered.isMine === false) && !resolvedOffered.myAssignmentId));
  /* eslint-disable react-hooks/preserve-manual-memoization -- load-bearing manual memo */
  const resolvedMeetupDays = useMemo(() => {
    const daySet = new Set(
      (mySlotsQuery.data?.slots ?? [])
        .filter(
          (s) =>
            s.section.id === resolvedSectionId &&
            (!resolvedSubjectId || s.subject.id === resolvedSubjectId),
        )
        .map((s) => s.day),
    );
    const days = [1, 2, 3, 4, 5].filter((d) => daySet.has(d));
    return days.length > 0 ? days : [1, 2, 3, 4, 5];
  }, [mySlotsQuery.data, resolvedSectionId, resolvedSubjectId]);
  /* eslint-enable react-hooks/preserve-manual-memoization */
  const { dateKeys: meetupDateKeys } = useMeetupDates(
    resolvedSectionId,
    resolvedSubjectId,
    resolvedMeetupDays,
  );
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayDow = now.getDay();
  const todayKey = now.toISOString().slice(0, 10);
  const gate: { live: AttendanceLive; slot: number } = (() => {
    const base = { nowMin, todayKey, todayEnd: null as number | null };
    const todayPH = phTodayKey();
    if (date < todayPH) {
      const subjectName = selectedPair?.subject?.name;
      return {
        live: {
          ...base,
          locked: false,
          tone: "info",
          message: subjectName
            ? `${subjectName} · past sheet ${date} — you can still edit these marks.`
            : `Past sheet ${date} — you can still edit these marks.`,
        },
        slot: 1,
      };
    }
    if (date > todayPH) {
      return {
        live: { ...base, locked: true, tone: "lock", message: "Future sheets are not available." },
        slot: 1,
      };
    }
    if (!selectedPair) {
      return {
        live: { ...base, locked: true, tone: "lock", message: "Select a subject to take attendance." },
        slot: 1,
      };
    }
    if (!selectedPair.subject || selectedPair.slots.length === 0) {
      return { live: { ...base, locked: false, tone: "info", message: null }, slot: 1 };
    }
    const cfg = configQuery.data?.config;
    if (!cfg) {
      return {
        live: { ...base, locked: true, tone: "lock", message: "Loading schedule times…" },
        slot: 1,
      };
    }
    const rows = buildTimetable(cfg);
    const timed = selectedPair.slots.flatMap((s) => {
      if (s.day !== todayDow) return [];
      const row = rows.find((r) => r.kind === "period" && r.periodIndex === s.period);
      return row && row.kind === "period" ? [{ ...s, start: row.startMin, end: row.endMin }] : [];
    });
    if (timed.length === 0) {
      return {
        live: {
          ...base,
          locked: true,
          tone: "lock",
          message: `No meetup today for ${selectedPair.subject.name}.`,
        },
        slot: 1,
      };
    }
    const todayEnd = Math.max(...timed.map((t) => t.end));
    const withEnd = { ...base, todayEnd };
    const liveSlot = timed.find((t) => nowMin >= t.start && nowMin < t.end);
    if (liveSlot) {
      return {
        live: {
          ...withEnd,
          locked: false,
          tone: "info",
          message: `${selectedPair.subject.name} is live now · ends ${formatClock(liveSlot.end)}.`,
        },
        // Slots are 1-based on the wire (timetable periods are 0-based).
        slot: liveSlot.period + 1,
      };
    }
    const done = [...timed]
      .filter((t) => nowMin >= t.end)
      .sort((a, b) => b.end - a.end)[0];
    if (done) {
      return {
        live: {
          ...withEnd,
          locked: false,
          tone: "info",
          message: `${selectedPair.subject.name} ended at ${formatClock(done.end)} — you can still edit these marks.`,
        },
        slot: done.period + 1,
      };
    }
    const next = [...timed].filter((t) => nowMin < t.start).sort((a, b) => a.start - b.start)[0]!;
    return {
      live: {
        ...withEnd,
        locked: true,
        tone: "lock",
        message: `Locked — ${selectedPair.subject.name} starts at ${formatClock(next.start)}. Attendance opens when class is live.`,
      },
      slot: next.period + 1,
    };
  })();
  const slot = gate.slot;
  const { slotCards, slotQuery, setSlotQuery } = useSlotCards(pairs, configQuery.data?.config, now);
  const activeSlotKey = slotKey ?? slotCards[0]?.key ?? null;
  const hasGrant = termGrant !== null || isMasterTeacher;
  const isAdvisoryPair =
    !!advisorySectionId && (selectedPair?.section.id ?? null) === advisorySectionId;
  const canMarkPair = isMasterTeacher
    ? true
    : !!termGrant && (!!termGrant.attendanceVerified || isAdvisoryPair);
  const needsVerifyForPair = !isMasterTeacher && hasGrant && !canMarkPair;
  const showSheetPicker = hasGrant && pairs.length > 0;
  const topbarCrumb = useMemo(
    () =>
      showSheetPicker ? (
        <SheetDatePicker date={date} onChange={setDate} meetupDates={meetupDateKeys} />
      ) : null,
    [showSheetPicker, date, meetupDateKeys],
  );
  useTopbarCrumb(topbarCrumb);
  if (meQuery.isPending || ((linked || isMasterTeacher) && mySlotsQuery.isPending)) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading attendance">
        <ZentraPageHeaderSkeleton />
        <ZentraFilterBarSkeleton selects={2} />
        <ZentraTableSkeleton rows={8} columns={4} />
      </section>
    );
  }
  if (!linked && !isMasterTeacher) {
    return (
      <section className={styles.page}>
        <div className={styles.gateBody}>
          <TeacherCodeClaim
            title="Link your teacher code"
            description="Enter the code next to your name in the master teacher's teacher list (e.g. MS-101). Your subjects and each section's students will attach here for per-subject attendance."
          />
        </div>
      </section>
    );
  }
  const handleVerify = () => {
    if (verify.isPending) return;
    if (!attCode.trim()) {
      setAttCodeError("Enter your teacher code to open attendance.");
      return;
    }
    setAttCodeError(null);
    verify.mutate(attCode.trim());
  };
  if (!hasGrant && !isMasterTeacher) {
    return (
      <AttendanceTermGate
        termLabel={termLabel}
        isAdviser={isAdviser}
        sectionName={sheetContext.data?.sectionName ?? null}
        showCodeVerify={showCodeVerify}
        attCode={attCode}
        attCodeError={attCodeError}
        verifyPending={verify.isPending}
        grantPending={grantTap.isPending}
        onAttCodeChange={(value) => {
          setAttCode(value);
          setAttCodeError(null);
        }}
        onShowCodeVerify={setShowCodeVerify}
        onBackToAdviser={() => setShowCodeVerify(false)}
        onVerify={handleVerify}
        onGrantTap={() => grantTap.mutate()}
      />
    );
  }
  return (
    <section className={styles.page}>
      {isMasterTeacher && pairs.length === 0 ? (
        !linked ? (
          <TermAccessCard
            linkedName={null}
            termLabel={termLabel}
            claimTitle="Link your teacher code"
            claimDescription="Enter the code next to your name in the teacher list (e.g. MS-101). Your subjects and each section's students will attach here for per-subject attendance."
            successTitle="Attendance unlocked"
            successDescription={`Your code matches — per-subject sheets are now open for ${termLabel}.`}
          />
        ) : (
          <div className="flex min-h-[calc(100dvh-10rem)] items-center justify-center">
            <div className="w-full max-w-3xl">
              <NoTermRecordsPanel
                termLabel={termLabel}
                isMasterTeacher
                teacherName={linked.name}
              />
            </div>
          </div>
        )
      ) : pairs.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-10rem)] items-center justify-center">
          <div className="w-full max-w-3xl">
            <NoTermRecordsPanel
              termLabel={termLabel}
              isMasterTeacher={false}
              teacherName={linked?.name ?? "your linked name"}
            />
          </div>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.main}>
            <div className="flex flex-wrap items-center justify-start gap-2 lg:hidden" aria-label="Sheet toolbar">
              <SheetDatePicker date={date} onChange={setDate} meetupDates={meetupDateKeys} />
            </div>
            <div className={styles.body}>
              {needsVerifyForPair ? (
                <VerifyCodeCard
                  sectionName={selectedPair?.section.name}
                  termLabel={termLabel}
                  attCode={attCode}
                  attCodeError={attCodeError}
                  verifyPending={verify.isPending}
                  onAttCodeChange={(value) => {
                    setAttCode(value);
                    setAttCodeError(null);
                  }}
                  onVerify={handleVerify}
                />
              ) : null}
              {takenByOther && resolvedOffered ? (
                <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                  This subject ({resolvedOffered.name}) is linked to {resolvedOffered.ownerTeacherName ?? resolvedOffered.teacherName} — only their linked students can be marked here. Select your own linked subject.
                </div>
              ) : null}
              <AttendanceRosterTable
                date={date}
                subjectId={resolvedSubjectId}
                assignmentId={resolvedAssignmentId}
                slot={slot}
                roster={resolvedSectionId ? rosterOverride : undefined}
                meetupDays={resolvedMeetupDays}
                live={{ ...gate.live, locked: gate.live.locked || needsVerifyForPair || takenByOther }}
                stretchClassName={styles.tableStretchRail}
              />
            </div>
          </div>
          <AttendanceSidebar
            slotCards={slotCards}
            hasSubjects={pairs.some((p) => p.subject)}
            activeSlotKey={activeSlotKey}
            slotQuery={slotQuery}
            onSlotQueryChange={setSlotQuery}
            onSelect={(card) => {
              setPairKey(card.pairKey);
              setSlotKey(card.key);
            }}
          />
        </div>
      )}
    </section>
  );
}
