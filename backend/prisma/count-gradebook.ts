import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const subjects = await prisma.subject.findMany({
    select: {
      id: true,
      code: true,
      gradeLevel: true,
      _count: { select: { gradeComponents: true, finalGrades: true, assignments: true } },
    },
    orderBy: [{ gradeLevel: "asc" }, { code: "asc" }],
  });
  const asmByComp = await prisma.assessment.groupBy({
    by: ["gradeComponentId"],
    _count: { _all: true },
  });
  const compToAsm = new Map(asmByComp.map((a) => [a.gradeComponentId, a._count._all]));
  const comps = await prisma.gradeComponent.findMany({ select: { id: true, subjectId: true } });
  const asmBySubject = new Map<string, number>();
  for (const c of comps) {
    asmBySubject.set(c.subjectId, (asmBySubject.get(c.subjectId) ?? 0) + (compToAsm.get(c.id) ?? 0));
  }
  console.log("code,grade,components,assessments,finalGrades,assignments");
  for (const s of subjects) {
    console.log(
      `${s.code},${s.gradeLevel},${s._count.gradeComponents},${asmBySubject.get(s.id) ?? 0},${s._count.finalGrades},${s._count.assignments}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
