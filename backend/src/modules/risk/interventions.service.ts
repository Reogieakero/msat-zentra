import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { OutcomeStatus, RiskLevel } from "../../generated/prisma/client.js";
import {
  resolveActiveTermId,
  computeRiskFactors,
  levelFromFlags,
} from "../../services/risk.js";
import { sectionHeadcounts } from "../../services/enrollment.js";
import type { TermScopeInput } from "../../lib/termScope.js";

export type ApprovalStatusValue = "pending" | "approved" | "rejected" | "modified";
export type OutcomeStatusValue = "ongoing" | "resolved" | "unresolved";
export type RiskLevelValue = "Low" | "Moderate" | "High";

export interface InterventionLink {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  assignedStaffName: string | null;
  approvalStatus: ApprovalStatusValue;
  outcomeStatus: OutcomeStatusValue;
  outcomeNotes: string | null;
  priority: string | null;
  intakeNotes: string | null;
  sessions: InterventionSessionLink[];
  createdAt: string | null;
}

export interface InterventionSessionLink {
  id: string;
  sessionType: string;
  scheduledAt: Date;
  venue: string | null;
  status: string;
  sessionNotes: string | null;
  outcome: string | null;
  cancelReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
  attachmentsCount: number;
}

export interface SubjectGrade {
  subject: string;
  code: string;
  computedAverage: number | null;
  transmutedGrade: number | null;
  belowThreshold: boolean;
}

export interface RiskFactors {
  academic: boolean;
  attendance: boolean;
  behavioral: boolean;
}

export interface RiskSnapshotStudent {
  studentId: string;
  lrn: string;
  studentName: string;
  section: string;
  gradeLevel: string;
  riskLevel: string;
  riskCount: number;
  snapshotDate: string | null;
  factors: RiskFactors;
  subjectGrades: SubjectGrade[];
  intervention: InterventionLink | null;
}

export interface InterventionStudentsResult {
  students: RiskSnapshotStudent[];
  total: number;
  page: number;
  pageSize: number;
  highModerate: number;
}

export interface StudentFilters {
  riskLevel?: RiskLevelValue;
  hasIntervention?: boolean;
  factor?: "Academic" | "Attendance" | "Behavioral";
  q?: string;
  section?: string;
  outcomeStatus?: OutcomeStatusValue;

  /** @deprecated ignored — all views are real-time unified. */
  gradeMode?: "raw" | "final";

  includeRecovered?: boolean;

  fullCohort?: boolean;
  page?: number;
  pageSize?: number;
}

type InterventionRow = {
  id: string;
  recommendedAction: string;
  assignedTo: string | null;
  approvalStatus: ApprovalStatusValue;
  outcomeStatus: OutcomeStatusValue;
  outcomeNotes: string | null;
  priority: string | null;
  intakeNotes: string | null;
  counselingSessions: {
    id: string;
    sessionType: string;
    scheduledAt: Date;
    venue: string | null;
    status: string;
    sessionNotes: string | null;
    outcome: string | null;
    cancelReason: string | null;
    createdAt: Date;
    completedAt: Date | null;
    attachments: { id: string }[];
  }[];
  assignedAt: Date | null;
  assignee: { fullName: string } | null;
};

function toInterventionLink(iv: InterventionRow | undefined): InterventionLink | null {
  return iv
    ? {
        id: iv.id,
        recommendedAction: iv.recommendedAction,
        assignedTo: iv.assignedTo,
        assignedStaffName: iv.assignee?.fullName ?? null,
        approvalStatus: iv.approvalStatus,
        outcomeStatus: iv.outcomeStatus,
        outcomeNotes: iv.outcomeNotes,
        priority: iv.priority,
        intakeNotes: iv.intakeNotes,
        sessions: iv.counselingSessions.map((s) => ({
          id: s.id,
          sessionType: s.sessionType,
          scheduledAt: s.scheduledAt,
          venue: s.venue,
          status: s.status,
          sessionNotes: s.sessionNotes,
          outcome: s.outcome,
          cancelReason: s.cancelReason,
          createdAt: s.createdAt,
          completedAt: s.completedAt,
          attachmentsCount: s.attachments.length,
        })),
        createdAt: iv.assignedAt ? iv.assignedAt.toISOString() : null,
      }
    : null;
}

export async function getInterventionStudents(
  filters: StudentFilters,
  scope?: TermScopeInput,
): Promise<InterventionStudentsResult> {
  const page = Math.max(1, filters.page ?? 1);
  // Strict 15-record ceiling for normal lists.
  const pageSize = Math.min(15, Math.max(1, filters.pageSize ?? 15));

  const termId = scope?.termId ?? (await resolveActiveTermId());
  const schoolYearId =
    scope?.schoolYearId ??
    (
      await prisma.schoolYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      })
    )?.id;

  if (!termId) {
    return { students: [], total: 0, page, pageSize, highModerate: 0 };
  }

  if (filters.fullCohort) {
    return getLiveCohortStudents(termId, schoolYearId, filters, page, pageSize);
  }

  const studentWhere: Record<string, unknown> = {};
  if (schoolYearId) studentWhere.section = { schoolYearId };
  if (filters.hasIntervention === true) studentWhere.interventions = { some: {} };
  if (filters.hasIntervention === false) studentWhere.interventions = { none: {} };

  const includeRecovered = filters.includeRecovered === true && !filters.riskLevel;
  const levelClause = includeRecovered
    ? {
        OR: [
          { riskLevel: { in: ["High", "Moderate"] as RiskLevel[] } },
          {
            riskLevel: "Low" as RiskLevel,
            student: {
              is: { interventions: { some: { outcomeStatus: "ongoing" as OutcomeStatus } } },
            },
          },
        ],
      }
    : { riskLevel: filters.riskLevel ? filters.riskLevel : ({ in: ["High", "Moderate"] as RiskLevel[] }) };
  const where = {
    termId,
    ...levelClause,
    ...(Object.keys(studentWhere).length ? { student: studentWhere } : {}),
  };

  const rosterWhere: Record<string, unknown> = {};
  if (schoolYearId) rosterWhere.section = { schoolYearId };
  if (filters.hasIntervention === true) rosterWhere.interventions = { some: {} };
  if (filters.hasIntervention === false) rosterWhere.interventions = { none: {} };

  const rosterLevelClause = includeRecovered
    ? {
        OR: [
          { riskLevel: { in: ["High", "Moderate"] as RiskLevel[] } },
          {
            riskLevel: "Low" as RiskLevel,
            roster: {
              is: { interventions: { some: { outcomeStatus: "ongoing" as OutcomeStatus } } },
            },
          },
        ],
      }
    : { riskLevel: filters.riskLevel ? filters.riskLevel : ({ in: ["High", "Moderate"] as RiskLevel[] }) };
  const rosterSnapWhere = {
    termId,
    ...rosterLevelClause,
    ...(Object.keys(rosterWhere).length ? { roster: rosterWhere } : {}),

    rosterId: { not: null },
  };

  const [snaps, rosterSnaps] = await Promise.all([
    prisma.riskSnapshot.findMany({
      where,
      orderBy: [{ riskLevel: "desc" }, { riskCount: "desc" }, { student: { lrn: "asc" } }],
      select: {
        id: true,
        riskLevel: true,
        riskCount: true,
        snapshotDate: true,
        student: {
          select: {
            userId: true,
            lrn: true,
            gradeLevel: true,
            section: { select: { id: true, name: true, _count: { select: { students: true } } } },
            user: { select: { fullName: true } },
            finalGrades: {
              where: { termId },
              select: {
                computedAverage: true,
                transmutedGrade: true,
                subject: { select: { name: true, code: true } },
              },
            },
            attendanceRecords: { where: { termId }, select: { status: true, subjectId: true } },
            anecdotalRecords: { where: { termId }, select: { id: true } },
            interventions: {
              orderBy: { id: "desc" },
              take: 1,
              select: {
                id: true,
                recommendedAction: true,
                assignedTo: true,
                approvalStatus: true,
                outcomeStatus: true,
                outcomeNotes: true,
                priority: true,
                intakeNotes: true,
                counselingSessions: {
                  orderBy: { scheduledAt: "asc" },
                  select: {
                    id: true,
                    sessionType: true,
                    scheduledAt: true,
                    venue: true,
                    status: true,
                    sessionNotes: true,
                    outcome: true,
                    cancelReason: true,
                    createdAt: true,
                    completedAt: true,
                    attachments: { select: { id: true } },
                  },
                },
                assignedAt: true,
                assignee: { select: { fullName: true } },
              },
            },
          },
        },
      },
    }),
    prisma.riskSnapshot.findMany({
      where: rosterSnapWhere,
      orderBy: [{ riskLevel: "desc" }, { riskCount: "desc" }],
      select: {
        id: true,
        riskLevel: true,
        riskCount: true,
        snapshotDate: true,
        rosterId: true,
        roster: {
          select: {
            id: true,
            lrn: true,
            fullName: true,
            gradeLevel: true,
            section: { select: { id: true, name: true } },
            finalGrades: {
              where: { termId },
              select: {
                computedAverage: true,
                transmutedGrade: true,
                subject: { select: { name: true, code: true } },
              },
            },
            attendanceRecords: { where: { termId }, select: { status: true, subjectId: true } },
            anecdotalRecords: { where: { termId }, select: { id: true } },
            interventions: {
              orderBy: { id: "desc" },
              take: 1,
              select: {
                id: true,
                recommendedAction: true,
                assignedTo: true,
                approvalStatus: true,
                outcomeStatus: true,
                outcomeNotes: true,
                priority: true,
                intakeNotes: true,
                counselingSessions: {
                  orderBy: { scheduledAt: "asc" },
                  select: {
                    id: true,
                    sessionType: true,
                    scheduledAt: true,
                    venue: true,
                    status: true,
                    sessionNotes: true,
                    outcome: true,
                    cancelReason: true,
                    createdAt: true,
                    completedAt: true,
                    attachments: { select: { id: true } },
                  },
                },
                assignedAt: true,
                assignee: { select: { fullName: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  type SnapRow = {
    snapshotDate: Date | null;
    studentId: string;
    lrn: string;
    studentName: string;
    section: string;
    sectionId: string;
    enrolledFallback: number;
    gradeLevel: string;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null; subject: { name: string; code: string } }[];
    attendanceRecords: { status: string; subjectId: string | null }[];
    anecdotalCount: number;
    intervention: InterventionLink | null;
  };
  const byStudent = new Map<string, { date: number; row: SnapRow; profile: boolean }>();
  const consider = (lrn: string, date: Date | null, row: SnapRow, profile: boolean) => {
    const prev = byStudent.get(lrn);
    const when = date?.getTime() ?? 0;

    if (!prev || when > prev.date || (when === prev.date && profile && !prev.profile)) {
      byStudent.set(lrn, { date: when, row, profile });
    }
  };
  for (const s of snaps) {
    const st = s.student;

    if (!st) continue;
    consider(st.lrn, s.snapshotDate, {
      snapshotDate: s.snapshotDate,
      studentId: st.userId,
      lrn: st.lrn,
      studentName: st.user.fullName,
      section: st.section?.name ?? "—",
      sectionId: st.section?.id ?? "",
      enrolledFallback: st.section?._count.students ?? 0,
      gradeLevel: st.gradeLevel,
      finalGrades: st.finalGrades,
      attendanceRecords: st.attendanceRecords,
      anecdotalCount: st.anecdotalRecords.length,
      intervention: toInterventionLink(st.interventions[0]),
    }, true);
  }
  for (const s of rosterSnaps) {
    const r = s.roster;
    if (!r) continue;
    consider(r.lrn, s.snapshotDate, {
      snapshotDate: s.snapshotDate,
      studentId: `roster:${r.id}`,
      lrn: r.lrn,
      studentName: r.fullName,
      section: r.section?.name ?? "—",
      sectionId: r.section?.id ?? "",
      enrolledFallback: 0,
      gradeLevel: r.gradeLevel,
      finalGrades: r.finalGrades,
      attendanceRecords: r.attendanceRecords,
      anecdotalCount: r.anecdotalRecords.length,
      intervention: toInterventionLink(r.interventions[0]),
    }, false);
  }
  const deduped = [...byStudent.values()].map((v) => v.row);

  const sectionIds = Array.from(new Set(deduped.map((r) => r.sectionId).filter(Boolean)));
  const headcounts = await sectionHeadcounts(sectionIds);

  const highModerate = deduped.length;

  const mapped: RiskSnapshotStudent[] = deduped.map((st) => {
    const enrolled = headcounts.get(st.sectionId) ?? st.enrolledFallback;
    const flags = computeRiskFactors({
      finalGrades: st.finalGrades.map((g) => ({
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
      })),
      attendance: st.attendanceRecords.map((a) => ({ status: a.status, subjectId: a.subjectId })),
      anecdotalCount: st.anecdotalCount,
      enrolled,
    });
    const level = levelFromFlags(flags);

    const subjectGrades: SubjectGrade[] = st.finalGrades.map((g) => ({
      subject: g.subject.name,
      code: g.subject.code,
      computedAverage: g.computedAverage,
      transmutedGrade: g.transmutedGrade,
      belowThreshold: (g.transmutedGrade ?? 100) < 75,
    }));

    return {
      studentId: st.studentId,
      lrn: st.lrn,
      studentName: st.studentName,
      section: st.section,
      gradeLevel: st.gradeLevel,
      riskLevel: level,
      riskCount:
        (flags.academicFlag ? 1 : 0) +
        (flags.attendanceFlag ? 1 : 0) +
        (flags.behavioralFlag ? 1 : 0),
      snapshotDate: st.snapshotDate ? st.snapshotDate.toISOString() : null,
      factors: {
        academic: flags.academicFlag,
        attendance: flags.attendanceFlag,
        behavioral: flags.behavioralFlag,
      },
      subjectGrades,
      intervention: st.intervention,
    };
  });

  const needle = (filters.q ?? "").trim().toLowerCase();
  const filtered = mapped.filter((m) => {
    if (filters.factor && !m.factors[filters.factor!.toLowerCase() as keyof RiskFactors]) return false;
    if (
      needle &&
      !`${m.studentName} ${m.lrn} ${m.section}`.toLowerCase().includes(needle)
    )
      return false;
    if (filters.section && m.section !== filters.section) return false;
    if (filters.outcomeStatus && m.intervention?.outcomeStatus !== filters.outcomeStatus) return false;
    return true;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const students = filtered.slice(start, start + pageSize);

  return { students, total, page, pageSize, highModerate };
}

const COHORT_LEVEL_RANK: Record<string, number> = { High: 0, Moderate: 1, Low: 2 };

export async function getColumnCohortStudents(
  termId: string,
  schoolYearId: string | undefined,
  filters: StudentFilters,
  page: number,
  pageSize: number
): Promise<InterventionStudentsResult> {
  const effPageSize = Math.min(Math.max(1, Math.floor(pageSize) || 15), 15);
  const needle = (filters.q ?? "").trim();
  const includeRecovered = filters.includeRecovered === true && !filters.riskLevel;

  const hasIntClause = filters.hasIntervention === true
    ? { interventions: { some: {} } }
    : filters.hasIntervention === false
      ? { interventions: { none: {} } }
      : null;
  const outcomeClause = filters.outcomeStatus
    ? { interventions: { some: { outcomeStatus: filters.outcomeStatus } } }
    : null;
  const profileLevelClause = filters.riskLevel
    ? { riskLevel: filters.riskLevel }
    : includeRecovered
      ? {
          OR: [
            { riskLevel: { in: ["High", "Moderate"] } },
            { riskLevel: "Low", interventions: { some: { outcomeStatus: "ongoing" } } },
          ],
        }
      : { riskLevel: { in: ["High", "Moderate"] } };
  const profileSearch: any = needle
    ? {
        OR: [
          { user: { fullName: { contains: needle, mode: "insensitive" } } },
          { lrn: { contains: needle, mode: "insensitive" } },
          { section: { name: { contains: needle, mode: "insensitive" } } },
        ],
      }
    : null;
  const profileWhere: any = {
    AND: [
      ...(schoolYearId ? [{ section: { schoolYearId } }] : []),
      ...(filters.section ? [{ section: { name: filters.section } }] : []),
      profileLevelClause,
      ...(hasIntClause ? [hasIntClause] : []),
      ...(outcomeClause ? [outcomeClause] : []),
      ...(filters.factor
        ? [{ [{ Academic: "academicFlag", Attendance: "attendanceFlag", Behavioral: "behavioralFlag" }[filters.factor]]: true }]
        : []),
      ...(profileSearch ? [profileSearch] : []),
    ],
  };

  const ivRoster = (extra: Prisma.Sql) => Prisma.sql`EXISTS (SELECT 1 FROM "Intervention" iv WHERE iv."rosterId" = r."id" AND ${extra})`;
  const rosterConds: Prisma.Sql[] = [];
  if (schoolYearId) rosterConds.push(Prisma.sql`r."schoolYearId" = ${schoolYearId}`);
  if (filters.section) rosterConds.push(Prisma.sql`s."name" = ${filters.section}`);
  if (filters.riskLevel) {
    rosterConds.push(Prisma.sql`r."riskLevel" = ${filters.riskLevel}`);
  } else if (includeRecovered) {
    rosterConds.push(
      Prisma.sql`(r."riskLevel" IN ('High', 'Moderate') OR (r."riskLevel" = 'Low' AND ${ivRoster(Prisma.sql`iv."outcomeStatus" = 'ongoing'`)}))`
    );
  } else {
    rosterConds.push(Prisma.sql`r."riskLevel" IN ('High', 'Moderate')`);
  }
  if (filters.hasIntervention === true) rosterConds.push(ivRoster(Prisma.sql`TRUE`));
  if (filters.hasIntervention === false)
    rosterConds.push(Prisma.sql`NOT ${ivRoster(Prisma.sql`TRUE`)}`);
  if (filters.outcomeStatus)
    rosterConds.push(ivRoster(Prisma.sql`iv."outcomeStatus" = ${filters.outcomeStatus}`));
  if (filters.factor)
    rosterConds.push(
      Prisma.sql`${Prisma.raw(`r."${{ Academic: "academicFlag", Attendance: "attendanceFlag", Behavioral: "behavioralFlag" }[filters.factor]}"`)} = TRUE`
    );
  if (needle)
    rosterConds.push(
      Prisma.sql`(r."fullName" ILIKE ${`%${needle}%`} OR r."lrn" ILIKE ${`%${needle}%`} OR s."name" ILIKE ${`%${needle}%`})`
    );
  const rosterScope = Prisma.sql`FROM "StudentRoster" r LEFT JOIN "Section" s ON s."id" = r."sectionId" WHERE ${Prisma.join(rosterConds, " AND ")} AND NOT EXISTS (SELECT 1 FROM "StudentProfile" p WHERE p."lrn" = r."lrn")`;

  const interventionSelect = {
    orderBy: { id: "desc" as const },
    take: 1,
    select: {
      id: true,
      recommendedAction: true,
      assignedTo: true,
      approvalStatus: true,
      outcomeStatus: true,
      outcomeNotes: true,
      priority: true,
      intakeNotes: true,
      counselingSessions: {
        orderBy: { scheduledAt: "asc" as const },
        select: {
          id: true,
          sessionType: true,
          scheduledAt: true,
          venue: true,
          status: true,
          sessionNotes: true,
          outcome: true,
          cancelReason: true,
          createdAt: true,
          completedAt: true,
          attachments: { select: { id: true } },
        },
      },
      assignedAt: true,
      assignee: { select: { fullName: true } },
    },
  } as const;

  const [profileTotal, rosterTotalRows, highModerateProfiles, highModerateRosters] = await Promise.all([
    prisma.studentProfile.count({ where: profileWhere }),
    prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS count ${rosterScope}`
    ),
    prisma.studentProfile.count({
      where: {
        AND: [
          ...(schoolYearId ? [{ section: { schoolYearId } }] : []),
          { riskLevel: { in: ["High", "Moderate"] } },
        ],
      },
    }),
    prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS count FROM "StudentRoster" r WHERE ${schoolYearId ? Prisma.sql`r."schoolYearId" = ${schoolYearId} AND ` : Prisma.sql``}r."riskLevel" IN ('High', 'Moderate') AND NOT EXISTS (SELECT 1 FROM "StudentProfile" p WHERE p."lrn" = r."lrn")`
    ),
  ]);
  const total = profileTotal + Number(rosterTotalRows[0]?.count ?? 0);
  const highModerate =
    highModerateProfiles + Number(highModerateRosters[0]?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / effPageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const windowTake = safePage * effPageSize;

  const [profileWindow, rosterIdWindow] = await Promise.all([
    prisma.studentProfile.findMany({
      where: profileWhere,
      orderBy: [{ riskLevel: "desc" }, { riskCount: "desc" }, { user: { fullName: "asc" } }],
      select: {
        userId: true,
        lrn: true,
        gradeLevel: true,
        riskLevel: true,
        riskCount: true,
        academicFlag: true,
        attendanceFlag: true,
        behavioralFlag: true,
        user: { select: { fullName: true } },
        section: { select: { name: true } },
        interventions: interventionSelect,
      },
      take: windowTake,
    }),
    prisma.$queryRaw<{ id: string; riskLevel: string; riskCount: number; fullName: string }[]>(
      Prisma.sql`SELECT r."id", r."riskLevel", r."riskCount", r."fullName" ${rosterScope} ORDER BY r."riskLevel" DESC, r."riskCount" DESC, r."fullName" ASC LIMIT ${windowTake} OFFSET 0`
    ),
  ]);

  type WindowRow = {
    kind: "profile" | "roster";
    studentId: string;
    lrn: string;
    studentName: string;
    section: string;
    gradeLevel: string;
    riskLevel: string;
    riskCount: number;
    academicFlag: boolean;
    attendanceFlag: boolean;
    behavioralFlag: boolean;
    intervention: InterventionRow | undefined;
  };
  const windowRows: WindowRow[] = [
    ...profileWindow.map((s) => ({
      kind: "profile" as const,
      studentId: s.userId,
      lrn: s.lrn,
      studentName: s.user.fullName,
      section: s.section?.name ?? "—",
      gradeLevel: String(s.gradeLevel),
      riskLevel: String(s.riskLevel),
      riskCount: s.riskCount,
      academicFlag: s.academicFlag,
      attendanceFlag: s.attendanceFlag,
      behavioralFlag: s.behavioralFlag,
      intervention: s.interventions[0] as InterventionRow | undefined,
    })),
    ...rosterIdWindow.map((r) => ({
      kind: "roster" as const,
      studentId: `roster:${r.id}`,
      lrn: "",
      studentName: "",
      section: "",
      gradeLevel: "",
      riskLevel: r.riskLevel,
      riskCount: r.riskCount,
      academicFlag: false,
      attendanceFlag: false,
      behavioralFlag: false,
      intervention: undefined as InterventionRow | undefined,
    })),
  ];
  const rosterWindowIds = rosterIdWindow.map((r) => r.id);
  const rosterHydrated = rosterWindowIds.length
    ? await prisma.studentRoster.findMany({
        where: { id: { in: rosterWindowIds } },
        select: {
          id: true,
          lrn: true,
          fullName: true,
          gradeLevel: true,
          riskLevel: true,
          riskCount: true,
          academicFlag: true,
          attendanceFlag: true,
          behavioralFlag: true,
          section: { select: { name: true } },
          interventions: interventionSelect,
        },
      })
    : [];
  const rosterById = new Map(rosterHydrated.map((r) => [r.id, r]));
  const merged: WindowRow[] = windowRows
    .map((w) => {
      if (w.kind === "profile") return w;
      const full = rosterById.get(w.studentId.slice(7));
      if (!full) return null;
      return {
        ...w,
        lrn: full.lrn,
        studentName: full.fullName,
        section: full.section?.name ?? "—",
        gradeLevel: String(full.gradeLevel),
        riskLevel: String(full.riskLevel),
        riskCount: full.riskCount,
        academicFlag: full.academicFlag,
        attendanceFlag: full.attendanceFlag,
        behavioralFlag: full.behavioralFlag,
        intervention: full.interventions[0] as InterventionRow | undefined,
      };
    })
    .filter((w): w is WindowRow => w !== null)
    .sort(
      (a, b) =>
        (COHORT_LEVEL_RANK[a.riskLevel] ?? 9) - (COHORT_LEVEL_RANK[b.riskLevel] ?? 9) ||
        b.riskCount - a.riskCount ||
        a.studentName.localeCompare(b.studentName)
    )
    .slice((safePage - 1) * effPageSize, safePage * effPageSize);

  const snapProfileIds = merged.filter((m) => m.kind === "profile").map((m) => m.studentId);
  const snapRosterIds = merged
    .filter((m) => m.kind === "roster")
    .map((m) => m.studentId.slice(7));
  const [snapP, snapR] = await Promise.all([
    snapProfileIds.length
      ? prisma.riskSnapshot.groupBy({
          by: ["studentId"],
          where: { termId, studentId: { in: snapProfileIds } },
          _max: { snapshotDate: true },
        })
      : Promise.resolve([] as { studentId: string | null; _max: { snapshotDate: Date | null } }[]),
    snapRosterIds.length
      ? prisma.riskSnapshot.groupBy({
          by: ["rosterId"],
          where: { termId, rosterId: { in: snapRosterIds } },
          _max: { snapshotDate: true },
        })
      : Promise.resolve([] as { rosterId: string | null; _max: { snapshotDate: Date | null } }[]),
  ]);
  const snapDateByKey = new Map<string, Date>();
  for (const g of snapP) if (g.studentId && g._max.snapshotDate) snapDateByKey.set(g.studentId, g._max.snapshotDate);
  for (const g of snapR)
    if (g.rosterId && g._max.snapshotDate) snapDateByKey.set(`roster:${g.rosterId}`, g._max.snapshotDate);

  const students: RiskSnapshotStudent[] = merged.map((m) => {
    const intervention = toInterventionLink(m.intervention);
    return {
      studentId: m.studentId,
      lrn: m.lrn,
      studentName: m.studentName,
      section: m.section,
      gradeLevel: m.gradeLevel,
      riskLevel: m.riskLevel,
      riskCount: m.riskCount,
      snapshotDate:
        snapDateByKey.get(m.studentId)?.toISOString() ?? intervention?.createdAt ?? null,
      factors: {
        academic: m.academicFlag,
        attendance: m.attendanceFlag,
        behavioral: m.behavioralFlag,
      },
      subjectGrades: [],
      intervention,
    };
  });

  return { students, total, page: safePage, pageSize: effPageSize, highModerate };
}

async function getLiveCohortStudents(
  termId: string,
  schoolYearId: string | undefined,
  filters: StudentFilters,
  page: number,
  pageSize: number,
): Promise<InterventionStudentsResult> {
  // Real-time unified: always live, gradeMode ignored.
  const includeRecovered = filters.includeRecovered === true && !filters.riskLevel;

  const [profiles, rosters, profileSnapDates, rosterSnapDates] = await Promise.all([
    prisma.studentProfile.findMany({
      where: schoolYearId ? { section: { schoolYearId } } : undefined,
      select: {
        userId: true,
        lrn: true,
        gradeLevel: true,
        section: { select: { id: true, name: true, _count: { select: { students: true } } } },
        user: { select: { fullName: true } },
        finalGrades: {
          where: { termId },
          select: {
            computedAverage: true,
            transmutedGrade: true,
            subject: { select: { name: true, code: true } },
          },
        },
        attendanceRecords: { where: { termId }, select: { status: true, date: true, subjectId: true } },
        anecdotalRecords: { where: { termId }, select: { id: true, observationDatetime: true } },
        interventions: {
          orderBy: { id: "desc" },
          take: 1,
          select: {
            id: true,
            recommendedAction: true,
            assignedTo: true,
            approvalStatus: true,
            outcomeStatus: true,
            outcomeNotes: true,
            priority: true,
            intakeNotes: true,
            counselingSessions: {
              orderBy: { scheduledAt: "asc" },
              select: {
                id: true,
                sessionType: true,
                scheduledAt: true,
                venue: true,
                status: true,
                sessionNotes: true,
                outcome: true,
                cancelReason: true,
                createdAt: true,
                completedAt: true,
                attachments: { select: { id: true } },
              },
            },
            assignedAt: true,
            assignee: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.studentRoster.findMany({
      where: schoolYearId ? { schoolYearId } : undefined,
      select: {
        id: true,
        lrn: true,
        fullName: true,
        gradeLevel: true,
        sectionId: true,
        section: { select: { id: true, name: true } },
        finalGrades: {
          where: { termId },
          select: {
            computedAverage: true,
            transmutedGrade: true,
            subject: { select: { name: true, code: true } },
          },
        },
        attendanceRecords: { where: { termId }, select: { status: true, date: true, subjectId: true } },
        anecdotalRecords: { where: { termId }, select: { id: true, observationDatetime: true } },
        interventions: {
          orderBy: { id: "desc" },
          take: 1,
          select: {
            id: true,
            recommendedAction: true,
            assignedTo: true,
            approvalStatus: true,
            outcomeStatus: true,
            outcomeNotes: true,
            priority: true,
            intakeNotes: true,
            counselingSessions: {
              orderBy: { scheduledAt: "asc" },
              select: {
                id: true,
                sessionType: true,
                scheduledAt: true,
                venue: true,
                status: true,
                sessionNotes: true,
                outcome: true,
                cancelReason: true,
                createdAt: true,
                completedAt: true,
                attachments: { select: { id: true } },
              },
            },
            assignedAt: true,
            assignee: { select: { fullName: true } },
          },
        },
      },
    }),
    prisma.riskSnapshot.groupBy({
      by: ["studentId"],
      where: { termId, NOT: { studentId: null } },
      _max: { snapshotDate: true },
    }),
    prisma.riskSnapshot.groupBy({
      by: ["rosterId"],
      where: { termId, NOT: { rosterId: null } },
      _max: { snapshotDate: true },
    }),
  ]);

  const snapByStudent = new Map(
    profileSnapDates.map((g) => [g.studentId as string, g._max.snapshotDate] as const)
  );
  const snapByRoster = new Map(
    rosterSnapDates.map((g) => [g.rosterId as string, g._max.snapshotDate] as const)
  );

  const sectionIds = Array.from(
    new Set([
      ...profiles.map((p) => p.section?.id).filter((id): id is string => Boolean(id)),
      ...rosters.map((r) => r.sectionId).filter(Boolean),
    ])
  );
  const headcounts = await sectionHeadcounts(sectionIds);

  type LiveInput = {
    studentId: string;
    lrn: string;
    studentName: string;
    section: string;
    sectionId: string;
    enrolledFallback: number;
    gradeLevel: string;
    finalGrades: { computedAverage: number | null; transmutedGrade: number | null; subject: { name: string; code: string } }[];
    attendanceRecords: { status: string; date: Date; subjectId: string | null }[];
    anecdotalRecords: { observationDatetime: Date }[];
    anecdotalCount: number;
    intervention: InterventionRow | undefined;
    snapshotDate: Date | null;
  };

  const toStudent = (st: LiveInput): RiskSnapshotStudent | null => {
    const enrolled = headcounts.get(st.sectionId) ?? st.enrolledFallback;
    const flags = computeRiskFactors({
      finalGrades: st.finalGrades.map((g) => ({
        computedAverage: g.computedAverage,
        transmutedGrade: g.transmutedGrade,
      })),
      attendance: st.attendanceRecords.map((a) => ({ status: a.status, subjectId: a.subjectId })),
      anecdotalCount: st.anecdotalCount,
      enrolled,
    });
    const level = levelFromFlags(flags);
    const intervention = toInterventionLink(st.intervention);

    const recovered = level === "Low" && intervention?.outcomeStatus === "ongoing";
    if (!includeRecovered && level !== "High" && level !== "Moderate") return null;
    if (includeRecovered && level !== "High" && level !== "Moderate" && !recovered) return null;
    if (filters.riskLevel && level !== filters.riskLevel) return null;
    if (filters.hasIntervention === true && !intervention) return null;
    if (filters.hasIntervention === false && intervention) return null;

    const subjectGrades: SubjectGrade[] = st.finalGrades.map((g) => ({
      subject: g.subject.name,
      code: g.subject.code,
      computedAverage: g.computedAverage,
      transmutedGrade: g.transmutedGrade,
      belowThreshold: (g.transmutedGrade ?? 100) < 75,
    }));

    const sessionTimes = (intervention?.sessions ?? [])
      .map((s) => new Date(s.createdAt).getTime())
      .filter((t) => Number.isFinite(t));
    const evidenceTimes = [
      ...st.attendanceRecords.map((a) => new Date(a.date).getTime()),
      ...st.anecdotalRecords.map((a) => new Date(a.observationDatetime).getTime()),
    ].filter((t) => Number.isFinite(t));
    const detectedAt =
      st.snapshotDate != null
        ? st.snapshotDate.toISOString()
        : (intervention?.createdAt ??
          (sessionTimes.length > 0
            ? new Date(Math.min(...sessionTimes)).toISOString()
            : evidenceTimes.length > 0
              ? new Date(Math.max(...evidenceTimes)).toISOString()
              : null));

    return {
      studentId: st.studentId,
      lrn: st.lrn,
      studentName: st.studentName,
      section: st.section,
      gradeLevel: st.gradeLevel,
      riskLevel: level,
      riskCount:
        (flags.academicFlag ? 1 : 0) +
        (flags.attendanceFlag ? 1 : 0) +
        (flags.behavioralFlag ? 1 : 0),
      snapshotDate: detectedAt,
      factors: {
        academic: flags.academicFlag,
        attendance: flags.attendanceFlag,
        behavioral: flags.behavioralFlag,
      },
      subjectGrades,
      intervention,
    };
  };

  const registeredLrns = new Set(profiles.map((p) => p.lrn));
  const kept: RiskSnapshotStudent[] = [];
  for (const p of profiles) {
    const row = toStudent({
      studentId: p.userId,
      lrn: p.lrn,
      studentName: p.user.fullName,
      section: p.section?.name ?? "—",
      sectionId: p.section?.id ?? "",
      enrolledFallback: p.section?._count.students ?? 0,
      gradeLevel: p.gradeLevel,
      finalGrades: p.finalGrades,
      attendanceRecords: p.attendanceRecords,
      anecdotalRecords: p.anecdotalRecords,
      anecdotalCount: p.anecdotalRecords.length,
      intervention: p.interventions[0],
      snapshotDate: snapByStudent.get(p.userId) ?? null,
    });
    if (row) kept.push(row);
  }
  for (const r of rosters) {
    if (registeredLrns.has(r.lrn)) continue;
    const row = toStudent({
      studentId: `roster:${r.id}`,
      lrn: r.lrn,
      studentName: r.fullName,
      section: r.section?.name ?? "—",
      sectionId: r.sectionId ?? r.section?.id ?? "",
      enrolledFallback: 0,
      gradeLevel: r.gradeLevel,
      finalGrades: r.finalGrades,
      attendanceRecords: r.attendanceRecords,
      anecdotalRecords: r.anecdotalRecords,
      anecdotalCount: r.anecdotalRecords.length,
      intervention: r.interventions[0],
      snapshotDate: snapByRoster.get(r.id) ?? null,
    });
    if (row) kept.push(row);
  }

  const levelRank = (level: string) =>
    level === "High" ? 0 : level === "Moderate" ? 1 : 2;
  kept.sort(
    (a, b) =>
      levelRank(a.riskLevel) - levelRank(b.riskLevel) ||
      b.riskCount - a.riskCount ||
      a.studentName.localeCompare(b.studentName)
  );

  const highModerate = kept.length;

  const needle = (filters.q ?? "").trim().toLowerCase();
  const filtered = kept.filter((m) => {
    if (filters.factor && !m.factors[filters.factor!.toLowerCase() as keyof RiskFactors]) return false;
    if (
      needle &&
      !`${m.studentName} ${m.lrn} ${m.section}`.toLowerCase().includes(needle)
    )
      return false;
    if (filters.section && m.section !== filters.section) return false;
    if (filters.outcomeStatus && m.intervention?.outcomeStatus !== filters.outcomeStatus) return false;
    return true;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const students = filtered.slice(start, start + pageSize);

  return { students, total, page, pageSize, highModerate };
}
