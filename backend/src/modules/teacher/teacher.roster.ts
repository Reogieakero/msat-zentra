import { prisma } from "../../lib/prisma.js";
import { subjectAverageAttendance } from "../../services/attendance.js";

export async function advisoryRoster(termId: string, sectionId: string) {
  const [profiles, rosterEntries, assignSubs, entrySubs] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { sectionId },
      select: { userId: true, lrn: true, user: { select: { fullName: true } } },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.studentRoster.findMany({
      where: { sectionId },
      select: { id: true, lrn: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.teacherSubjectAssignment.findMany({
      where: { sectionId, termId },
      select: { subjectId: true },
      distinct: ["subjectId"],
    }),
    prisma.sectionTimetableEntry.findMany({
      where: { sectionId, termId, status: { in: ["APPROVED", "SUBMITTED"] } },
      select: { subjectId: true, day: true },
    }),
  ]);
  const offeredIds = [
    ...new Set([...assignSubs.map((s) => s.subjectId), ...entrySubs.map((s) => s.subjectId)]),
  ];
  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const rosterOnly = rosterEntries.filter((r) => !registeredLrns.has(r.lrn));
  const profileIds = profiles.map((p) => p.userId);
  const rosterIds = rosterOnly.map((r) => r.id);
  const keyOf = (studentId: string | null, rosterId: string | null): string | null =>
    studentId ?? (rosterId ? `roster:${rosterId}` : null);

  const [profileFinals, rosterFinals, takes, avgs, term] = await Promise.all([
    profileIds.length > 0 && offeredIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { termId, subjectId: { in: offeredIds }, studentId: { in: profileIds } },
          select: { studentId: true, computedAverage: true, transmutedGrade: true },
        })
      : Promise.resolve([] as { studentId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    rosterIds.length > 0 && offeredIds.length > 0
      ? prisma.finalGrade.findMany({
          where: { termId, subjectId: { in: offeredIds }, rosterId: { in: rosterIds } },
          select: { rosterId: true, computedAverage: true, transmutedGrade: true },
        })
      : Promise.resolve([] as { rosterId: string | null; computedAverage: number | null; transmutedGrade: number | null }[]),
    offeredIds.length > 0
      ? prisma.attendanceRecord.findMany({
          where: { termId, sectionId, subjectId: { in: offeredIds } },
          select: { studentId: true, rosterId: true, subjectId: true, status: true, date: true },
        })
      : Promise.resolve([] as { studentId: string | null; rosterId: string | null; subjectId: string | null; status: string; date: Date }[]),
    subjectAverageAttendance([sectionId], termId),
    prisma.term.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const finalsByKey = new Map<string, { computedAverage: number | null; transmutedGrade: number | null }[]>();
  for (const f of profileFinals) {
    const key = keyOf(f.studentId, null);
    if (!key) continue;
    const arr = finalsByKey.get(key) ?? [];
    arr.push({ computedAverage: f.computedAverage, transmutedGrade: f.transmutedGrade });
    finalsByKey.set(key, arr);
  }
  for (const f of rosterFinals) {
    const key = keyOf(null, f.rosterId);
    if (!key) continue;
    const arr = finalsByKey.get(key) ?? [];
    arr.push({ computedAverage: f.computedAverage, transmutedGrade: f.transmutedGrade });
    finalsByKey.set(key, arr);
  }

  const meetupDays = new Map<string, Set<number>>();
  for (const e of entrySubs) {
    const set = meetupDays.get(e.subjectId) ?? new Set<number>();
    set.add(e.day);
    meetupDays.set(e.subjectId, set);
  }
  const startStr = term?.startDate?.toISOString().slice(0, 10) ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const termEndStr = term?.endDate?.toISOString().slice(0, 10) ?? null;
  const endStr = termEndStr && termEndStr < todayStr ? termEndStr : todayStr;
  const elapsedBySubject = new Map<string, Set<string>>();
  if (startStr && startStr <= endStr && offeredIds.length > 0) {
    for (const sid of offeredIds) {
      const days = meetupDays.get(sid) ?? new Set([1, 2, 3, 4, 5]);
      const set = new Set<string>();
      for (
        let d = new Date(`${startStr}T00:00:00Z`);
        d.toISOString().slice(0, 10) <= endStr;
        d = new Date(d.getTime() + 86_400_000)
      ) {
        const dow = d.getUTCDay();
        const day = dow === 0 ? 7 : dow;
        if (days.has(day)) set.add(d.toISOString().slice(0, 10));
      }
      if (set.size > 0) elapsedBySubject.set(sid, set);
    }
  }
  const sectionMeetups = [...elapsedBySubject.values()].reduce((n, s) => n + s.size, 0);
  const presentDays = new Map<string, Set<string>>();
  for (const t of takes) {
    if (t.status !== "present") continue;
    const key = keyOf(t.studentId, t.rosterId);
    if (!key || !t.subjectId) continue;
    const dayKey = t.date.toISOString().slice(0, 10);
    if (!elapsedBySubject.get(t.subjectId)?.has(dayKey)) continue;
    const cellKey = `${key}|${t.subjectId}`;
    const set = presentDays.get(cellKey) ?? new Set<string>();
    set.add(dayKey);
    presentDays.set(cellKey, set);
  }
  const presentByKey = new Map<string, number>();
  for (const [cellKey, dates] of presentDays) {
    const key = cellKey.slice(0, cellKey.lastIndexOf("|"));
    presentByKey.set(key, (presentByKey.get(key) ?? 0) + dates.size);
  }

  const r1 = (n: number) => Math.round(n * 10) / 10;
  const mean = (ns: (number | null)[]): number | null => {
    const vals = ns.filter((n): n is number => n !== null);
    return vals.length > 0 ? r1(vals.reduce((s, n) => s + n, 0) / vals.length) : null;
  };

  return [
    ...profiles.map((p) => ({
      studentId: p.userId,
      name: p.user.fullName,
      lrn: p.lrn,
      hasAccount: true as const,
    })),
    ...rosterOnly.map((r) => ({
      studentId: `roster:${r.id}`,
      name: r.fullName,
      lrn: r.lrn,
      hasAccount: false as const,
    })),
  ]
    .map((s) => {
      const avg = avgs.get(s.studentId)?.average ?? null;
      const finals = finalsByKey.get(s.studentId) ?? [];
      return {
        ...s,
        attendancePresent: presentByKey.get(s.studentId) ?? 0,
        attendanceTotal: sectionMeetups,
        attendancePercentage: avg === null ? null : Math.round(avg * 1000) / 10,
        computedAverage: mean(finals.map((f) => f.computedAverage)),
        academicGrade: mean(finals.map((f) => f.transmutedGrade)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
