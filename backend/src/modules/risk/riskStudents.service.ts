import { prisma } from "../../lib/prisma.js";

export type RiskFactor = "Academic" | "Attendance" | "Behavioral";

export interface RiskStudentRow {
  studentId: string;
  lrn: string;
  name: string;
  section: string;
  riskLevel: string;
  riskCount: number;
  factors: Record<RiskFactor, boolean>;
}

export interface RiskStudentsResult {
  students: RiskStudentRow[];
  total: number;
  page: number;
  pageSize: number;
}

async function resolveActiveTermId(): Promise<string | null> {
  const term = await prisma.term.findFirst({
    where: { schoolYear: { isActive: true } },
    orderBy: { termNumber: "asc" },
    select: { id: true },
  });
  return term?.id ?? null;
}

// Principal: full at-risk student list (status-only factors, no confidential
// fields) for the active school year. Optional section filter.
export async function getRiskStudents(
  page: number,
  pageSize: number,
  section?: string
): Promise<RiskStudentsResult> {
  const termId = await resolveActiveTermId();
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  const schoolYearId = schoolYear?.id;

  const where = {
    ...(schoolYearId ? { section: { schoolYearId } } : {}),
    ...(section ? { section: { name: section, ...(schoolYearId ? { schoolYearId } : {}) } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.studentProfile.findMany({
      where,
      orderBy: [{ riskLevel: "desc" }, { lrn: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        userId: true,
        lrn: true,
        riskLevel: true,
        riskCount: true,
        section: { select: { name: true } },
        user: { select: { fullName: true } },
        finalGrades: { where: termId ? { termId } : undefined, select: { transmutedGrade: true } },
        attendanceRecords: { where: termId ? { termId } : undefined, select: { status: true } },
        anecdotalRecords: { where: termId ? { termId } : undefined, select: { id: true } },
      },
    }),
    prisma.studentProfile.count({ where }),
  ]);

  const students: RiskStudentRow[] = rows.map((s) => {
    const avg =
      s.finalGrades.length > 0
        ? s.finalGrades.reduce((sum, g) => sum + (g.transmutedGrade ?? 0), 0) /
          s.finalGrades.length
        : 100;
    const present = s.attendanceRecords.filter((a) => a.status === "present").length;
    const totalAtt = s.attendanceRecords.length;
    const academic = avg < 75;
    const attendance = totalAtt > 0 && present / totalAtt < 0.8;
    const behavioral = s.anecdotalRecords.length > 0;
    // Derive level + count from the live factors so the list always matches
    // the engine rule (risk.ts): >=2 = High, 1 = Moderate, 0 = Low. The stored
    // profile columns can be stale, so we never trust them here.
    const liveCount =
      (academic ? 1 : 0) + (attendance ? 1 : 0) + (behavioral ? 1 : 0);
    const liveLevel: string =
      liveCount >= 2 ? "High" : liveCount === 1 ? "Moderate" : "Low";
    return {
      studentId: s.userId,
      lrn: s.lrn,
      name: s.user.fullName,
      section: s.section?.name ?? "—",
      riskLevel: liveLevel,
      riskCount: liveCount,
      factors: { Academic: academic, Attendance: attendance, Behavioral: behavioral },
    };
  });

  return { students, total, page, pageSize };
}
