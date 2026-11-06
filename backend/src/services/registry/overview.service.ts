import { prisma } from "../../lib/prisma.js";
import { gradeLabel, schoolYearClause } from "../../modules/registry/registry.repository.js";
import { normalizeApprovedLrnAt } from "./access.service.js";
import type { RegistryContext } from "./registry.types.js";

export interface OverviewTakes {
  attachTake?: number;
  missingTake?: number;
  pendingTake?: number;
  bareTake?: number;
}

/* ---- SF10 access-request daily activity ---------------------------------- */

/** Days of request activity returned — backs the 7/30/90-day chart filter. */
const REQUEST_WINDOW_DAYS = 90;

export interface Sf10RequestDayRow {
  date: string;
  /** Requests submitted that day. */
  pending: number;
  /** Students granted that day, bucketed by their approve date. */
  approved: number;
  /** Students reported missing that day, bucketed by their report date. */
  reported: number;
  /** Requests denied that day. */
  denied: number;
}

/** Local-date key ("YYYY-MM-DD") used to bucket the daily series. */
function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Buckets request activity into its day. "Pending" and "denied" count the
 * requests themselves (submitted / denied that day); "approved" and
 * "reported" count the per-student decisions by their own timestamps —
 * every LRN grant/report carries its date in approvedLrnAt/reportedLrnAt,
 * so students land on the day the desk acted, not the day the request
 * arrived.
 */
function buildRequestDaily(
  rows: {
    requestedAt: Date;
    decidedAt: Date | null;
    status: string;
    approvedLrnAt: unknown;
    reportedLrnAt: unknown;
  }[],
  since: Date
): Sf10RequestDayRow[] {
  const byDay = new Map<string, Sf10RequestDayRow>();
  // Pre-seed every day so the chart keeps a continuous axis on quiet days.
  for (let i = 0; i < REQUEST_WINDOW_DAYS; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = dayKey(d);
    byDay.set(key, { date: key, pending: 0, approved: 0, reported: 0, denied: 0 });
  }
  const bump = (
    ts: Date | string | null,
    field: "pending" | "approved" | "reported" | "denied"
  ) => {
    if (!ts) return;
    const day = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(day.getTime())) return;
    const row = byDay.get(dayKey(day));
    if (row) row[field]++;
  };
  for (const r of rows) {
    bump(r.requestedAt, "pending");
    if (r.status === "denied") bump(r.decidedAt, "denied");
    for (const at of Object.values(normalizeApprovedLrnAt(r.approvedLrnAt)))
      bump(at, "approved");
    for (const at of Object.values(normalizeApprovedLrnAt(r.reportedLrnAt)))
      bump(at, "reported");
  }
  return [...byDay.values()];
}

export async function getOverview(ctx: RegistryContext, takes: OverviewTakes, schoolYearId: string | null) {
  const band = ctx.band;

  const pendingAdviserAccess = await prisma.staffProfile.count({
    where: { isAdviser: true, user: { status: "pending" } },
  });

  const inBand = {
    OR: [
      { student: { gradeLevel: { in: band } } },
      { roster: { gradeLevel: { in: band } } },
    ],
  };

  const viewableFinalRows = await prisma.finalGrade.findMany({
    where: inBand,
    select: {
      lockStatus: true,
      studentId: true,
      rosterId: true,
      termId: true,
      subjectId: true,
    },
  });
  const byStudentTerm = new Map<string, typeof viewableFinalRows>();
  for (const r of viewableFinalRows) {
    const key = `${r.studentId ?? `roster:${r.rosterId}`}|${r.termId}`;
    if (!byStudentTerm.has(key)) byStudentTerm.set(key, []);
    byStudentTerm.get(key)!.push(r);
  }
  let readyRows = 0;
  let readyStudents = 0;
  for (const group of byStudentTerm.values()) {
    if (group.length > 0 && group.every((r) => r.lockStatus === "adviser_approved")) {
      readyRows += group.length;
      readyStudents++;
    }
  }
  const awaitingRows = readyRows;
  const reportCards = viewableFinalRows.length;

  const requestSince = new Date();
  requestSince.setHours(0, 0, 0, 0);
  requestSince.setDate(requestSince.getDate() - (REQUEST_WINDOW_DAYS - 1));

  const [sf10ByStatus, sectionsGrouped, subjectsGrouped, sf10Requests, rosterGradeCounts] =
    await Promise.all([
    prisma.sf10Record.groupBy({
      by: ["status"],
      where: { student: { gradeLevel: { in: band } } },
      _count: { _all: true },
    }),
    prisma.section.groupBy({
      by: ["gradeLevel"],
      where: { gradeLevel: { in: band }, ...schoolYearClause(schoolYearId) },
      _count: { _all: true },
    }),
    prisma.subject.groupBy({
      by: ["gradeLevel"],
      where: { gradeLevel: { in: band } },
      _count: { _all: true },
    }),
    // Adviser SF10 access-request activity in the trailing window — the daily
    // chart buckets each event (submitted / granted / reported / decided) by
    // day. Grants and reports live inside JSON columns (LRN → ISO), so the
    // row is selected here and bucketed in JS; the pre-seeded window drops
    // any out-of-window dates.
    prisma.adviserSf10AccessRequest.findMany({
      where: {
        gradeLevel: { in: band },
        OR: [
          { requestedAt: { gte: requestSince } },
          { checkedAt: { gte: requestSince } },
          { decidedAt: { gte: requestSince } },
        ],
      },
      select: {
        requestedAt: true,
        decidedAt: true,
        status: true,
        approvedLrnAt: true,
        reportedLrnAt: true,
      },
    }),
    // Per-grade roster counts (class-list learners) for the population chart.
    Promise.all(
      band.map((g) =>
        prisma.studentRoster.count({
          where: { gradeLevel: g, ...schoolYearClause(schoolYearId) },
        })
      )
    ),
  ]);

  const sf10Total = sf10ByStatus.reduce((sum, r) => sum + r._count._all, 0);
  const sections = sectionsGrouped.reduce((sum, r) => sum + r._count._all, 0);
  const subjects = subjectsGrouped.reduce((sum, r) => sum + r._count._all, 0);
  const sf10Released = sf10ByStatus.find((r) => r.status === "released")?._count._all ?? 0;
  const sf10Available = sf10ByStatus.find((r) => r.status === "available")?._count._all ?? 0;
  const sf10Attach = sf10ByStatus.find((r) => r.status === "attach")?._count._all ?? 0;

  const latestAttachRows = await prisma.sf10Record.findMany({
    where: { status: "attach", student: { gradeLevel: { in: band } } },
    orderBy: { validatedAt: "desc" },
    ...(takes.attachTake !== undefined ? { take: takes.attachTake } : {}),
    select: {
      // The report overlay on the desk overview opens by record id, so the
      // feed rows must carry it alongside the display fields.
      id: true,
      validatedAt: true,
      student: {
        select: { lrn: true, gradeLevel: true, user: { select: { fullName: true } } },
      },
    },
  });
  const latestAttachments = latestAttachRows.map((r) => ({
    id: r.id,
    student: r.student.user.fullName,
    lrn: r.student.lrn,
    grade: gradeLabel(r.student.gradeLevel),

    when: (r.validatedAt ?? new Date(0)).toISOString(),
  }));

  const missingRows = await prisma.studentProfile.findMany({
    where: { gradeLevel: { in: band }, sf10Records: { none: {} } },
    ...(takes.missingTake !== undefined ? { take: takes.missingTake } : {}),
    select: {
      lrn: true,
      gradeLevel: true,
      section: { select: { name: true } },
      user: { select: { fullName: true } },
    },
  });
  const missingSf10 = missingRows.map((s) => ({
    student: s.user.fullName,
    lrn: s.lrn,
    grade: gradeLabel(s.gradeLevel),
    section: s.section?.name ?? "—",
  }));

  const [profiledPending, barePending] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { gradeLevel: { in: band }, user: { status: "pending" } },
      ...(takes.pendingTake !== undefined ? { take: takes.pendingTake } : {}),
      select: {
        lrn: true,
        gradeLevel: true,
        user: { select: { fullName: true } },
        parentLinks: {
          take: 1,
          select: { parent: { select: { user: { select: { fullName: true } } } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { status: "pending", role: "student", studentProfile: null },
      ...(takes.bareTake !== undefined ? { take: takes.bareTake } : {}),
      select: { fullName: true, lrn: true },
    }),
  ]);

  const bareLrns = [...new Set(barePending.map((u) => u.lrn).filter((l): l is string => !!l))];
  const bareRosters =
    bareLrns.length > 0
      ? await prisma.studentRoster.findMany({
          where: { lrn: { in: bareLrns } },
          select: { lrn: true, gradeLevel: true, schoolYearId: true },
        })
      : [];
  const latestRosterByLrn = new Map<string, (typeof bareRosters)[number]>();
  for (const r of bareRosters) {
    const prev = latestRosterByLrn.get(r.lrn);
    if (!prev || r.schoolYearId > prev.schoolYearId) latestRosterByLrn.set(r.lrn, r);
  }
  const bareRows: { name: string; lrn: string; gradeLevel: string }[] = [];
  for (const u of barePending) {
    if (!u.lrn) continue;
    const roster = latestRosterByLrn.get(u.lrn);
    if (roster) {
      if (!band.includes(roster.gradeLevel)) continue;
      bareRows.push({ name: u.fullName, lrn: u.lrn, gradeLevel: roster.gradeLevel });
    } else {

      bareRows.push({ name: u.fullName, lrn: u.lrn, gradeLevel: "—" });
    }
  }

  const pendingStudents = [
    ...profiledPending.map((s) => ({
      name: s.user.fullName,
      lrn: s.lrn,
      grade: gradeLabel(s.gradeLevel),
      parent: s.parentLinks[0]?.parent.user.fullName ?? "—",
    })),
    ...bareRows.map((r) => ({
      name: r.name,
      lrn: r.lrn,
      grade: gradeLabel(r.gradeLevel),
      parent: "—",
    })),
  ];

  const sf10StudentRows = await prisma.studentProfile.findMany({
    where: { gradeLevel: { in: band }, sf10Records: { some: {} } },
    take: 5,
    select: {
      lrn: true,
      gradeLevel: true,
      user: { select: { fullName: true } },
    },
  });
  const sf10Students = sf10StudentRows.map((s) => ({
    name: s.user.fullName,
    lrn: s.lrn,
    grade: gradeLabel(s.gradeLevel),
  }));

  const pendingAccounts = pendingStudents.length + pendingAdviserAccess;

  return {
    pendingAccounts,
    pendingAdviserAccess,
    lockedFinalsAwaiting: awaitingRows,
    sf10Released,
    sections,
    subjects,
    reportCards,
    latestAttachments,
    missingSf10,
    pendingStudents,
    sf10Students,
    finals: {
      total: reportCards,
      finalized: 0,
      awaiting: awaitingRows,
      draft: reportCards - awaitingRows,
    },
    sf10: {
      total: sf10Total,
      released: sf10Released,
      available: sf10Available,
      attach: sf10Attach,
    },
    sectionsByGrade: band.map((g) => ({
      grade: gradeLabel(g),
      count: sectionsGrouped.find((r) => r.gradeLevel === g)?._count._all ?? 0,
    })),
    subjectsByGrade: band.map((g) => ({
      grade: gradeLabel(g),
      count: subjectsGrouped.find((r) => r.gradeLevel === g)?._count._all ?? 0,
    })),
    sf10RequestsDaily: buildRequestDaily(sf10Requests, requestSince),
    rosterByGrade: band.map((g, i) => ({
      grade: gradeLabel(g),
      count: rosterGradeCounts[i] ?? 0,
    })),
  };
}
