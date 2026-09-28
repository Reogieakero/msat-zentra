"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { AttendanceRosterTable } from "./components/AttendanceRosterTable";
import {
  phTodayKey,
  useOfferedSubjects,
  useSectionRoster,
  useSheetContext,
  type SheetContext,
} from "./components/attendance-taking-data";
import { KeyRound } from "lucide-react";
import { TeacherCodeClaim } from "@/components/schedule/TeacherCodeClaim";
import { useLinksLayout } from "@/lib/links-layout";
import { SectionScheduleCard } from "@/components/schedule/SectionScheduleCard";
import { WEEK_LABELS_SHORT } from "@/app/teacher/classes/components/classes-data";
import {
  buildTimetable,
  formatClock,
  formatRange,
  type DayConfig,
} from "@/app/teacher/schedule/components/schedule-time";
import type { AttendanceLive } from "./components/AttendanceRosterTable";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import emptyStyles from "@/app/teacher/schedule/schedule-empty.module.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import styles from "./components/attendance-sheet.module.css";

interface LinkedName {
  id: string;
  name: string;
  code: string | null;
  attendanceVerified: boolean;
}

interface MySlot {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; gradeLevel: string };
}

/* Per-subject attendance. The section list unions the teacher's advisory
   section with sections attached to their linked teacher-list code
   (committed timetable slots) — entering the code is what gives a
   subject teacher their subjects and each section's students here. */
function getVerifyErrorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return "Could not verify teacher code.";
}

export default function TeacherAdvisoryAttendancePage() {
  const queryClient = useQueryClient();
  const [linksLayout] = useLinksLayout();
  // Live clock for the time gate — re-evaluates the current slot every
  // minute so marking opens the moment class goes live.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  // Session defaults behind the scenes (today; slot resolves from the
  // live/finished meetup below) — no visible filters on this page.
  const date = phTodayKey();
  // This page has its own code input, separate from My Classes. The entered
  // code must match the schedule link code or attendance stays locked. The
  // unlock persists in the database on the link row, so leaving and coming
  // back never asks again until the row is unlinked.
  const [attCode, setAttCode] = useState("");
  const [attCodeError, setAttCodeError] = useState<string | null>(null);

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

  const mySlotsQuery = useQuery<{ slots: MySlot[] }>({
    queryKey: ["teacher-my-slots"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ slots: MySlot[] }>(
        "/api/teacher/schedule/my-slots",
      );
      return data;
    },
    enabled: linked !== null,
  });

  const sheetContext = useSheetContext();

  const configQuery = useQuery<{ config: DayConfig }>({
    queryKey: ["teacher-schedule-config"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ config: DayConfig }>(
        "/api/teacher/schedule/config",
      );
      return data;
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
      // The persisted flag flips the gate via the me-query refetch below.
      void queryClient.invalidateQueries({ queryKey: ["teacher-schedule-me"] });
      // Badge + bell update instantly; the channel keeps them live after.
      void queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] });
      toast.success({
        title: "Attendance unlocked",
        description: "Your code matches — per-subject sheets are now open.",
      });
    },
    onError: (err: unknown) => {
      const message = getVerifyErrorMessage(err);
      setAttCodeError(message);
      toast.error({ title: "Could not verify code", description: message });
    },
  });

  // One card per assigned subject: every code-linked (section, subject)
  // pair, plus the advisory section on its own when it has no linked slots
  // yet. Each pair carries its slots for status + timeslot times.
  const pairs = (() => {
    const list: {
      key: string;
      section: { id: string; name: string; gradeLevel: string | null };
      subject: { id: string; name: string; code: string } | null;
      slots: { day: number; period: number; status: "DRAFT" | "SUBMITTED" | "APPROVED" }[];
    }[] = [];
    const ordered = [...(mySlotsQuery.data?.slots ?? [])].sort(
      (a, b) => a.day - b.day || a.period - b.period,
    );
    for (const s of ordered) {
      const key = `${s.section.id}|${s.subject.id}`;
      let entry = list.find((l) => l.key === key);
      if (!entry) {
        entry = {
          key,
          section: { id: s.section.id, name: s.section.name, gradeLevel: s.section.gradeLevel },
          subject: { ...s.subject },
          slots: [],
        };
        list.push(entry);
      }
      entry.slots.push({ day: s.day, period: s.period, status: s.status });
    }
    if (sheetContext.data && !list.some((l) => l.section.id === sheetContext.data!.sectionId)) {
      list.unshift({
        key: sheetContext.data.sectionId,
        section: { id: sheetContext.data.sectionId, name: sheetContext.data.sectionName, gradeLevel: null },
        subject: null,
        slots: [],
      });
    }
    return list;
  })();

  const [pairKey, setPairKey] = useState<string | undefined>(undefined);
  const selectedPair = pairs.find((p) => p.key === pairKey) ?? pairs[0];

  const timeFor = (period: number): string | null => {
    const cfg = configQuery.data?.config;
    if (!cfg) return null;
    const row = buildTimetable(cfg).find((r) => r.kind === "period" && r.periodIndex === period);
    return row && row.kind === "period" ? formatRange(row.startMin, row.endMin) : null;
  };

  const pairTimes = (pair: (typeof pairs)[number]): string[] =>
    pair.slots.map((s) => {
      const t = timeFor(s.period);
      return `${WEEK_LABELS_SHORT[s.day - 1]} ${t ?? `Period ${s.period + 1}`}`;
    });

  // Defaults resolve during render (no effects): first pair, then its
  // subject (or the first markable offered subject). Explicit picks win.
  const resolvedSectionId = selectedPair?.section.id;

  const rosterQuery = useSectionRoster(resolvedSectionId);
  const rosterOverride: { ctx: SheetContext | null; pending: boolean; error: boolean } = {
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
  };

  const offeredQuery = useOfferedSubjects(resolvedSectionId, rosterQuery.data?.termId);
  const offered = offeredQuery.data ?? [];
  const resolvedSubjectId =
    selectedPair?.subject?.id ??
    offered.find((s) => s.canMark)?.subjectId ??
    offered[0]?.subjectId;
  // Meetup weekdays of the active subject in the active section (from the
  // linked timetable slots) — drives the blocks-view columns.
  const meetupDaySet = new Set(
    (mySlotsQuery.data?.slots ?? [])
      .filter(
        (s) =>
          s.section.id === resolvedSectionId &&
          (!resolvedSubjectId || s.subject.id === resolvedSubjectId),
      )
      .map((s) => s.day),
  );
  const meetupDays = [1, 2, 3, 4, 5].filter((d) => meetupDaySet.has(d));
  const resolvedMeetupDays = meetupDays.length > 0 ? meetupDays : [1, 2, 3, 4, 5];

  // Time gate: the sheet marks only while its slot is live; finished slots
  // stay editable; everything else is locked. Pairs without timetable slots
  // (legacy advisory flow) have nothing to gate against and stay open.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayDow = now.getDay();
  const todayKey = now.toISOString().slice(0, 10);
  const gate: { live: AttendanceLive; slot: number } = (() => {
    const base = { nowMin, todayKey, todayEnd: null as number | null };
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
        slot: liveSlot.period,
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
        slot: done.period,
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
      slot: next.period,
    };
  })();
  const slot = gate.slot;

  if (meQuery.isPending || (linked && mySlotsQuery.isPending && sheetContext.isPending)) {
    return (
      <section className={styles.page}>
        <div className={styles.body}>
          <p className="text-sm text-muted-foreground" aria-busy="true">
            Loading attendance…
          </p>
        </div>
      </section>
    );
  }

  // No advisory section and no linked code: the teacher must link their
  // code first to resolve their subjects and section students.
  if (!linked && sheetContext.isError) {
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

  // Separate attendance code gate, persisted in the database on the link
  // row — verified once, open on every visit until the row is unlinked.
  const verified = linked?.attendanceVerified === true;
  if (!verified) {
    return (
      <section className={styles.page}>
        <div className={styles.gateBody}>
          <div className={emptyStyles.emptyWrap}>
            <div className={assign.card} style={{ width: "100%", maxWidth: "28rem" }}>
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-col items-center text-center">
                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
                  <KeyRound size={32} className="text-primary" />
                </span>
                <h3 className="text-lg font-semibold">Enter teacher code</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Enter the same teacher code you linked on My Classes to open
                  per-subject attendance for your sections.
                </p>
                <div className="mt-4 flex w-full flex-col gap-2">
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
                    aria-label="Attendance teacher code"
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }



  return (
    <section className={styles.page}>
      {pairs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sections attached yet — your sections will appear here once the master
          teacher schedules your linked name.
        </p>
      ) : (
        <div className={styles.layout}>
          <div className={styles.main}>
            <div className={styles.body}>
              <AttendanceRosterTable
                date={date}
                subjectId={resolvedSubjectId}
                assignmentId={offered.find((s) => s.subjectId === resolvedSubjectId)?.assignmentId}
                slot={slot}
                roster={resolvedSectionId ? rosterOverride : undefined}
                meetupDays={resolvedMeetupDays}
                live={gate.live}
                stretchClassName={linksLayout === "sidebar" ? styles.tableStretchRail : styles.tableStretch}
              />
            </div>
          </div>
          <aside className={styles.sideList} aria-label="Assigned subjects">
            {pairs.map((p) => {
              const times = pairTimes(p);
              const title = p.subject ? p.subject.name : p.section.name;
              const ariaSummary = p.subject
                ? `${p.subject.name} (${p.subject.code}) in ${p.section.name} — ${times.join(", ")}`
                : "no subjects yet";
              return (
                <SectionScheduleCard
                  key={p.key}
                  onSelect={() => setPairKey(p.key)}
                  selected={p.key === selectedPair?.key}
                  tone="green"
                  ariaLabel={`Take attendance for ${title} — ${ariaSummary}`}
                  titleLabel={p.subject ? "Subject" : "Section"}
                  gradeLevel={p.section.gradeLevel}
                  sectionName={title}
                  adviserName={null}
                  timetableEntries={p.slots.map((s) => ({ status: s.status }))}
                  hint="Tap to take attendance"
                  middle={
                    p.subject ? (
                      <span className={assign.teacherBlock}>
                        <span
                          className={assign.itemName}
                          title={`${p.section.name} (${p.subject.code})`}
                        >
                          {p.section.name} ({p.subject.code})
                        </span>
                        <span className={assign.itemTerm} title={times.join(", ")}>
                          {times.join(" · ")}
                        </span>
                      </span>
                    ) : (
                      <span className={assign.teacherBlock}>
                        <span className={assign.fieldLabel}>Subjects</span>
                        <span className={assign.itemTerm}>No scheduled subjects</span>
                      </span>
                    )
                  }
                />
              );
            })}
          </aside>
        </div>
      )}
    </section>
  );
}
