import { prisma } from "../../lib/prisma.js";

export interface LowRiskStudent {
  lrn: string;
  name: string;
}

export interface LowRiskResult {
  students: LowRiskStudent[];
  total: number;
  page: number;
  pageSize: number;
}

// Low-risk students (riskLevel = "Low") in the active school year, paginated.
export async function getLowRiskStudents(
  page: number,
  pageSize: number
): Promise<LowRiskResult> {
  const schoolYear = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  const schoolYearId = schoolYear?.id;

  const where = schoolYearId
    ? { riskLevel: "Low" as const, section: { schoolYearId } }
    : { riskLevel: "Low" as const };

  const [rows, total] = await Promise.all([
    prisma.studentProfile.findMany({
      where,
      orderBy: { lrn: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        lrn: true,
        user: { select: { fullName: true } },
      },
    }),
    prisma.studentProfile.count({ where }),
  ]);

  return {
    students: rows.map((r) => ({ lrn: r.lrn, name: r.user.fullName })),
    total,
    page,
    pageSize,
  };
}
