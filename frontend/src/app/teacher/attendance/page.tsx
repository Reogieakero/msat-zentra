"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTopbarCrumb } from "@/app/teacher/layout";
import { useMutation, useQuery } from "@tanstack/react-query";
import { markSelfNotified } from "@/lib/realtime/teacherChannel";
import { useTeacherInvalidate } from "../components/use-teacher-invalidate";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "@/components/ui/sonner";
import { AttendanceRosterTable } from "./components/AttendanceRosterTable";
import { SheetDatePicker } from "./components/sheet-date-picker";
import {
  phTodayKey,
  useMeetupDates,
  useOfferedSubjects,
  useSectionRoster,
  useSheetContext,
  type SheetContext,
} from "./components/attendance-taking-data";
import { KeyRound } from "lucide-react";
import { TeacherCodeClaim } from "@/components/schedule/TeacherCodeClaim";
import { TermAccessCard } from "@/components/schedule/TermAccessCard";
import { NoTermRecordsPanel } from "@/components/schedule/NoTermRecordsPanel";
import { useSession } from "@/lib/auth/useSession";
import {
  useCachedMasterTeacher,
  useTeacherOverview,
} from "@/app/teacher/overview/components/teacher-overview-data";
import { useTerm } from "@/lib/term/TermContext";
import BranchedMenu from "@/components/nav/BranchedMenu";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
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
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { BookOpen, Search } from "lucide-react";
import styles from "./components/attendance-sheet.module.css";

interface LinkedName {
  id: string;
  name: string;
  code: string | null;
}

/** This term's verification grant (DB-saved auth flow per term). Null means
 *  the term has not been entered yet — Term 1 state never opens Term 2. */
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
}

/* Per-subject, per-term attendance workspace. The session rail lists ONLY the
   login teacher's own assigned subjects — the same `my-slots` source as My
   Classes (/teacher/classes): committed timetable slots attached to their
   linked teacher-list code. Every term asks first (adviser tap-through or
   the same link code re-entered) and records a DB grant row for that term;
   Term 1 state never opens another term, and bulk submits enforce the grant
   server-side. */
function getVerifyErrorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: { message?: unknown }; message?: unknown } } })?.response?.data;
  const message = data?.error?.message ?? data?.message;
  if (typeof message === "string" && message) return message;
  if (err instanceof Error && err.message) return err.message;
  return "Could not verify teacher code.";
}

export default function TeacherAdvisoryAttendancePage() {
  const invalidateTeacher = useTeacherInvalidate();
  // Live clock for the time gate — re-evaluates the current slot every
  // minute so marking opens the moment class goes live.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  // Sheet date (today by default; the table's date picker can look back at
  // past sheets only — future dates are capped). Slot resolves from the
  // live/finished meetup below.
  const [date, setDate] = useState(phTodayKey);
  // This page has its own code input, separate from My Classes. The entered
  // code must match the schedule link code or attendance stays locked. The
  // unlock persists in the database on the link row, so leaving and coming
  // back never asks again until the teacher leaves the term.
  const [attCode, setAttCode] = useState("");
  const [attCodeError, setAttCodeError] = useState<string | null>(null);
  // NOTE (Rules of Hooks): all state lives up here — nothing may hook
  // below the early returns further down.
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

  // Currently designated Master Teacher bypasses every code gate here —
  // student and subject records open directly, no link/term code.
  const session = useSession();
  const overview = useTeacherOverview();
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher =
    overview.data?.isMasterTeacher ?? meQuery.data?.isMasterTeacher ?? cachedMaster;

  const mySlotsQuery = useQuery<{ slots: MySlot[] }>({
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
      const { data } = await apiClient.get<{ config: DayConfig }>(
        "/api/teacher/schedule/config",
      );
      return data;
    },
  });

  // Advisory identity for this login (shared roster cache): answers the
  // per-term "adviser or not" question without an extra endpoint.
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
      // Suppress the unlock echo toast (the success toast already fired).
      if (data?.teacherName?.id) markSelfNotified(data.teacherName.id);
      // The persisted term grant flips the gate via the me-query refetch.
      invalidateTeacher.schedule();
      toast.success({
        title: "Attendance unlocked",
        description: `Your code matches — per-subject sheets are now open for ${termLabel}.`,
      });
    },
    onError: (err: unknown) => {
      const message = getVerifyErrorMessage(err);
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
      invalidateTeacher.schedule();
      toast.success({
        title: "Term entered",
        description: `Workspace open as adviser for ${termLabel}.`,
      });
    },
    onError: (err: unknown) => {
      const message = getVerifyErrorMessage(err);
      toast.error({ title: "Could not enter term", description: message });
    },
  });

  // Assigned subjects only — the login teacher's own timetable slots
  // (same `my-slots` source as My Classes), grouped by (section, subject).
  // No advisory fallback: this is a per-subject attendance workspace, so the
  // rail must never show subjects the teacher is not assigned to.
  // Memoized: this page re-renders every minute (live clock) and on every
  // rail-search keystroke — rebuilding the sorted/grouped list each time
  // also invalidated every downstream memo (slot lookup, rail groups, crumb).
  const pairs = useMemo(() => {
    const list: {
      key: string;
      section: { id: string; name: string; gradeLevel: string | null };
      subject: { id: string; name: string; code: string } | null;
      slots: { day: number; period: number; status: "DRAFT" | "SUBMITTED" | "APPROVED" }[];
    }[] = [];
    const byKey = new Map<string, (typeof list)[number]>();
    const ordered = [...(mySlotsQuery.data?.slots ?? [])].sort(
      (a, b) => a.day - b.day || a.period - b.period,
    );
    for (const s of ordered) {
      const key = `${s.section.id}|${s.subject.id}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          key,
          section: { id: s.section.id, name: s.section.name, gradeLevel: s.section.gradeLevel },
          subject: { ...s.subject },
          slots: [],
        };
        byKey.set(key, entry);
        list.push(entry);
      }
      entry.slots.push({ day: s.day, period: s.period, status: s.status });
    }
    return list;
    // grouped purely from slots data
  }, [mySlotsQuery.data]);

  const [pairKey, setPairKey] = useState<string | undefined>(undefined);
  const [slotKey, setSlotKey] = useState<string | null>(null);
  const [slotQuery, setSlotQuery] = useState("");
  const selectedPair = pairs.find((p) => p.key === pairKey) ?? pairs[0];

  const timeFor = (period: number): string | null => {
    const cfg = configQuery.data?.config;
    if (!cfg) return null;
    const row = buildTimetable(cfg).find((r) => r.kind === "period" && r.periodIndex === period);
    return row && row.kind === "period" ? formatRange(row.startMin, row.endMin) : null;
  };

  // Defaults resolve during render (no effects): first pair, then its
  // subject (or the first markable offered subject). Explicit picks win.
  const resolvedSectionId = selectedPair?.section.id;

  const rosterQuery = useSectionRoster(resolvedSectionId);
  // `requestedSectionId` is the card the teacher picked; `ctx` may still
  // hold the previous section while the new roster loads (keep-previous).
  // The sheet compares the two and loads instead of ever rendering another
  // section's students as the current sheet.
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
  const resolvedSubjectId =
    selectedPair?.subject?.id ??
    offered.find((s) => s.canMark)?.subjectId ??
    offered[0]?.subjectId;
  // Meetup weekdays of the active subject in the active section (from the
  // linked timetable slots) — drives the blocks-view columns. Memoized to a
  // stable reference: it feeds the meetup-keys memo, which feeds the navbar
  // crumb memo — a fresh array every render would re-publish the crumb and
  // loop `setCrumb` forever (Rules of Hooks + layout effect). The compiler
  // cannot preserve this manual memo, so it stays hand-rolled on purpose.
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
  // Term-scoped meetup date keys for the active subject — shared cache with
  // the sheet, drives the navbar picker's markable days.
  const { dateKeys: meetupDateKeys } = useMeetupDates(
    resolvedSectionId,
    resolvedSubjectId,
    resolvedMeetupDays,
  );

  // Time gate: the sheet marks only while its slot is live; finished slots
  // stay editable; everything else is locked.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayDow = now.getDay();
  const todayKey = now.toISOString().slice(0, 10);
  const gate: { live: AttendanceLive; slot: number } = (() => {
    const base = { nowMin, todayKey, todayEnd: null as number | null };
    const todayPH = phTodayKey();
    // Past sheets stay editable (no live session to gate against); future
    // sheets are unreachable (the picker caps at today) but stay locked.
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

  // One rail card per (day, period) session — never one card per subject.
  // Live sessions sort first; otherwise the nearest upcoming session leads.
  // Memoized on the minute + slot/config data: without this the sort +
  // haystack filter re-ran on every keystroke AND every parent re-render.
  // The search box filters on the debounced value so typing never blocks
  // the rail.
  const debouncedSlotQuery = useDebouncedValue(slotQuery, 250);
  const slotCards = useMemo(() => {
    const cfg = configQuery.data?.config;
    const rows = cfg ? buildTimetable(cfg) : [];
    const rangeOf = (period: number): { start: number; end: number } | null => {
      const row = rows.find((r) => r.kind === "period" && r.periodIndex === period);
      return row && row.kind === "period" ? { start: row.startMin, end: row.endMin } : null;
    };
    type SlotCard = {
      key: string;
      pairKey: string;
      section: { id: string; name: string; gradeLevel: string | null };
      subject: { id: string; name: string; code: string };
      day: number;
      period: number;
      status: "DRAFT" | "SUBMITTED" | "APPROVED";
      time: string | null;
      /** Clock minutes for the compact rail label (null when unscheduled). */
      start: number | null;
      end: number | null;
      live: boolean;
      rank: number;
      haystack: string;
    };
    const cards: SlotCard[] = [];
    for (const p of pairs) {
      if (!p.subject) continue;
      for (const s of p.slots) {
        const t = timeFor(s.period);
        const range = rangeOf(s.period);
        const timeLabel = `${WEEK_LABELS_SHORT[s.day - 1]} ${t ?? `Period ${s.period + 1}`}`;
        let rank: number;
        let live = false;
        if (s.day === todayDow && range) {
          if (nowMin >= range.start && nowMin < range.end) {
            rank = -1;
            live = true;
          } else if (nowMin < range.start) {
            rank = range.start;
          } else {
            rank = 100000 - range.end;
          }
        } else {
          const offset = (((s.day - todayDow) % 7) + 7) % 7;
          rank = offset === 0 ? 300000 : 200000 + offset * 10000 + (range?.start ?? 0);
        }
        cards.push({
          key: `${p.key}|${s.day}|${s.period}`,
          pairKey: p.key,
          section: p.section,
          subject: p.subject,
          day: s.day,
          period: s.period,
          status: s.status,
          time: t,
          start: range?.start ?? null,
          end: range?.end ?? null,
          live,
          rank,
          haystack: `${p.subject.name} ${p.subject.code} ${p.section.name} ${timeLabel}`.toLowerCase(),
        });
      }
    }
    const q = debouncedSlotQuery.trim().toLowerCase();
    return cards
      .filter((c) => q === "" || c.haystack.includes(q))
      .sort((a, b) => a.rank - b.rank);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timeFor/range read config only
  }, [pairs, configQuery.data, nowMin, todayDow, debouncedSlotQuery]);
  const activeSlotKey = slotKey ?? slotCards[0]?.key ?? null;

  // Branched session nav (same design as the left sidebar links and the
  // overview Student List rail): one group per section, one row per
  // (day × period) session. Values are slot-card keys. Labels use a compact
  // clock range ("Tue 7:30–8:30 AM") so rows never truncate in the rail.
  const railScrollRef = useRef<HTMLDivElement | null>(null);
  const slotByKey = useMemo(() => new Map(slotCards.map((c) => [c.key, c])), [slotCards]);
  const railGroups = useMemo(() => {
    const shortClock = (min: number): string => {
      const h24 = ((Math.floor(min / 60) % 24) + 24) % 24;
      const m = ((min % 60) + 60) % 60;
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${h12}:${m.toString().padStart(2, "0")}`;
    };
    const meridiem = (min: number): string =>
      ((Math.floor(min / 60) % 24) + 24) % 24 >= 12 ? "PM" : "AM";
    const compactRange = (start: number | null, end: number | null, fallback: string | null): string => {
      if (start === null || end === null) return fallback ?? "";
      const endMeridiem = meridiem(end);
      const startMeridiem = meridiem(start) === endMeridiem ? "" : ` ${meridiem(start)}`;
      return `${shortClock(start)}${startMeridiem}–${shortClock(end)} ${endMeridiem}`;
    };
    const bySection = new Map<string, typeof slotCards>();
    for (const c of slotCards) {
      const arr = bySection.get(c.section.id) ?? [];
      arr.push(c);
      bySection.set(c.section.id, arr);
    }
    return [...bySection.values()].map((items) => ({
      label: items[0].section.name,
      children: items.map((c) => ({
        value: c.key,
        label: `${c.subject.code} · ${WEEK_LABELS_SHORT[c.day - 1]} ${compactRange(c.start, c.end, c.time)}${c.live ? " · Live" : ""}`,
        icon: <BookOpen size={16} strokeWidth={1.8} aria-hidden="true" />,
      })),
    }));
  }, [slotCards]);

  // Per-term workspace gate (DB-saved auth flow per term): no grant row for
  // this term means the term hasn't been entered yet — Term 1 state never
  // opens it. Marking additionally needs the code unlock, except inside the
  // teacher's own advisory section (adviser grant suffices there).
  // The currently designated Master Teacher skips all of this.
  const hasGrant = termGrant !== null || isMasterTeacher;
  const isAdvisoryPair =
    !!advisorySectionId && (selectedPair?.section.id ?? null) === advisorySectionId;
  const canMarkPair = isMasterTeacher
    ? true
    : !!termGrant && (!!termGrant.attendanceVerified || isAdvisoryPair);
  const needsVerifyForPair = !isMasterTeacher && hasGrant && !canMarkPair;

  // Sheet date picker in the top navbar (left-aligned with the main panel
  // via the layout's crumb slot). Published only once the term is entered
  // with assigned sessions; unmount/gate clears it. NOTE: all
  // hooks must stay above every early return — Rules of Hooks.
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
      <section className={styles.page}>
        <div className={styles.body}>
          <p className="text-sm text-muted-foreground" aria-busy="true">
            Loading attendance…
          </p>
        </div>
      </section>
    );
  }

  // No linked code: the teacher must link their code first — same gate as
  // My Classes — to resolve their assigned subjects and section students.
  // The currently designated Master Teacher never sees this gate.
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

  // Term entry: each term asks first. Advisers answer with one tap
  // ("continue as adviser"); everyone else answers with their link code
  // (same code re-entered per term). Nothing carries across terms.
  // Masters bypass — records open directly.
  if (!hasGrant && !isMasterTeacher) {
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
                <h3 className="text-lg font-semibold">Enter {termLabel}</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {isAdviser
                    ? `You advise ${sheetContext.data?.sectionName ?? "a section"} — continue as adviser to open per-subject attendance for ${termLabel}, or verify with your teacher code instead.`
                    : `Enter the same teacher code you linked on My Classes to open per-subject attendance for ${termLabel}. Codes never carry across terms.`}
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
        </div>
      </section>
    );
  }



  return (
    <section className={styles.page}>
      {isMasterTeacher && pairs.length === 0 ? (
        // No code linked yet: just the centered code input — no info panel.
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
            {/* Small screens only — on desktop the picker lives in the top
                navbar crumb slot (left of the main panel). */}
            <div className="flex flex-wrap items-center justify-start gap-2 lg:hidden" aria-label="Sheet toolbar">
              <SheetDatePicker date={date} onChange={setDate} meetupDates={meetupDateKeys} />
            </div>
            <div className={styles.body}>
              {needsVerifyForPair ? (
                <div className={assign.card} aria-label="Verify code for this section">
                  <span className={assign.glowClip} aria-hidden="true">
                    <span className={assign.cardGlow} />
                  </span>
                  <div className="relative flex flex-col gap-2">
                    <p className="text-sm">
                      <span className="font-semibold">{selectedPair?.section.name}</span>
                      <span className="text-muted-foreground">
                        {" "}is outside your advisory — verify your teacher code to mark
                        attendance here for {termLabel}.
                      </span>
                    </p>
                    <div className="flex flex-col gap-2">
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
              ) : null}
              <AttendanceRosterTable
                date={date}
                subjectId={resolvedSubjectId}
                assignmentId={offered.find((s) => s.subjectId === resolvedSubjectId)?.assignmentId}
                slot={slot}
                roster={resolvedSectionId ? rosterOverride : undefined}
                meetupDays={resolvedMeetupDays}
                live={{ ...gate.live, locked: gate.live.locked || needsVerifyForPair }}
                stretchClassName={styles.tableStretchRail}
              />
            </div>
          </div>
          <aside className={styles.sideList} aria-label="Class sessions">
            <InputGroup className="w-full shrink-0">
              <InputGroupInput
                placeholder="Search sessions..."
                value={slotQuery}
                onChange={(event) => setSlotQuery(event.target.value)}
                aria-label="Search class sessions"
              />
              <InputGroupAddon>
                <Search size={16} aria-hidden />
              </InputGroupAddon>
            </InputGroup>
            <div className={styles.railScrollWrap}>
              <div ref={railScrollRef} className={styles.railScroll}>
                {slotCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {pairs.some((p) => p.subject)
                      ? "No sessions match your search."
                      : "No scheduled sessions yet."}
                  </p>
                ) : (
                  <BranchedMenu
                    items={railGroups}
                    defaultOpen={railGroups.map((_, i) => i)}
                    defaultActive={activeSlotKey ?? ""}
                    activeValue={activeSlotKey ?? ""}
                    onSelect={(value) => {
                      const card = slotByKey.get(value);
                      if (!card) return;
                      setPairKey(card.pairKey);
                      setSlotKey(card.key);
                    }}
                    width={248}
                    indent={28}
                  />
                )}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-1.5 pt-6">
                <ScrollDownHint
                  scrollRef={railScrollRef}
                  watchKey={`${slotCards.length}:${slotQuery}`}
                  label="Scroll for more sessions"
                  className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
                />
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
