import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const assessments = await prisma.assessment.findMany({
    select: {
      id: true,
      title: true,
      maxScore: true,
      gradeComponent: { select: { subject: { select: { code: true, gradeLevel: true } } } },
      _count: { select: { studentGrades: true } },
    },
  });
  const sections = await prisma.section.findMany({
    select: { gradeLevel: true, rosterEntries: { select: { id: true } } },
  });
  const byGrade = new Map<string, number>();
  for (const s of sections) {
    byGrade.set(s.gradeLevel, (byGrade.get(s.gradeLevel) ?? 0) + s.rosterEntries.length);
  }
  let full = 0;
  let partial = 0;
  let empty = 0;
  console.log("code,title,graded,expected,status");
  for (const a of assessments) {
    const grade = a.gradeComponent.subject.gradeLevel;
    const expected = byGrade.get(grade) ?? 0;
    const got = a._count.studentGrades;
    const status = got >= expected && expected > 0 ? "FULL" : got === 0 ? "EMPTY" : "PARTIAL";
    if (status === "FULL") full++;
    else if (status === "PARTIAL") partial++;
    else empty++;
    if (status !== "FULL") {
      console.log(`${a.gradeComponent.subject.code},"${a.title}",${got},${expected},${status}`);
    }
  }
  console.log(`summary: total=${assessments.length} full=${full} partial=${partial} empty=${empty}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
