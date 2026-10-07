import { prisma } from "../../lib/prisma.js";
import { gradeLabel, schoolYearClause } from "../../modules/registry/registry.repository.js";
import type { RegistryContext } from "./registry.types.js";

export interface OverviewTakes {
  attachTake?: number;
  missingTake?: number;
  pendingTake?: number;
  bareTake?: number;
}

// Records-desk overview (band authority only). Every query is scoped to the
// desk grade band so counts/lists never leak other-grade data. All values
// are computed live from the database — no mocked data.
export async function getOverview(ctx: RegistryContext, takes: OverviewTakes, schoolYearId: string | null) {
  const band = ctx.band;

  // pendingAdviserAccess: adviser staff accounts whose User is still pending.
  const pendingAdviserAccess = await prisma.staffProfile.count({
    where: { isAdviser: true, user: { status: "pending" } },
  });

  // Report cards: every final-grade row for in-band students (one row ≈ one
  // report-card subject entry). Used as a proxy since there is no dedicated
  // "report card" model. Roster-enlisted students without accounts count too.
  // Single read: the total is the row count (was a duplicate count query).
  const inBand = {
    OR: [
      { student: { gradeLevel: { in: band } } },
      { roster: { gradeLevel: { in: band } } },
    ],
  };

  // The desk is view-only in the grade pipeline: a student's term grades
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

  // sections/subjects: in-band active sections and subjects (KPI metrics).
  // Totals derive from the grouped reads below — no duplicate counts.
  // sf10ByStatus / sectionsByGrade / subjectsByGrade feed the overview
  // header's KPI charts (donuts + per-grade bars).
  const [sf10ByStatus, sectionsGrouped, subjectsGrouped] = await Promise.all([
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
  ]);

  const sf10Total = sf10ByStatus.reduce((sum, r) => sum + r._count._all, 0);
  const sections = sectionsGrouped.reduce((sum, r) => sum + r._count._all, 0);
  const subjects = subjectsGrouped.reduce((sum, r) => sum + r._count._all, 0);
  const sf10Released = sf10ByStatus.find((r) => r.status === "released")?._count._all ?? 0;
  const sf10Available = sf10ByStatus.find((r) => r.status === "available")?._count._all ?? 0;
  const sf10Attach = sf10ByStatus.find((r) => r.status === "attach")?._count._all ?? 0;

  // latestAttachments: most recent SF10 records in "attach" status (in-band).
  // Sf10Record has no updatedAt, so order by validatedAt (nullable) desc.
  const latestAttachRows = await prisma.sf10Record.findMany({
    where: { status: "attach", student: { gradeLevel: { in: band } } },
    orderBy: { validatedAt: "desc" },
    ...(takes.attachTake !== undefined ? { take: takes.attachTake } : {}),
    select: {
      validatedAt: true,
      student: {
        select: { lrn: true, gradeLevel: true, user: { select: { fullName: true } } },
      },
    },
  });
  const latestAttachments = latestAttachRows.map((r) => ({
    student: r.student.user.fullName,
    lrn: r.student.lrn,
    grade: gradeLabel(r.student.gradeLevel),
    // ISO timestamp — frontend formats it relative ("2m ago").
    when: (r.validatedAt ?? new Date(0)).toISOString(),
  }));

  // missingSf10: in-band students with NO sf10Record at all.
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

  // pendingStudents: in-band students whose User is still pending (newly
  // enrolled awaiting approval). Includes both profiled students and bare
  // self-sign-ups with no profile yet (their claimed LRN resolves them into
  // the band from the official StudentRoster), reconciling with /api/auth/pending.
  // Include first linked parent fullName.
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

  // Resolve bare sign-ups into the band from the roster; skip only the ones
  // whose LRN resolves to a roster entry OUTSIDE the band. A bare sign-up
  // with an unresolvable LRN is still included (mirrors /api/auth/pending),
  // shown with an unknown grade so the Overview and Accounts counts match.
  // Single batched read (was N sequential findFirst calls, max 15).
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
      if (!band.includes(roster.gradeLevel)) continue; // out-of-band skip
      bareRows.push({ name: u.fullName, lrn: u.lrn, gradeLevel: roster.gradeLevel });
    } else {
      // Unresolvable LRN — still pending/included like /api/auth/pending.
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

  // sf10Students: in-band students who have an SF10 record (any status), take 5.
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

  // pendingAccounts: account requests the desk can action — in-band student
  // enrollments awaiting approval plus adviser-access requests.
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
  };
}
