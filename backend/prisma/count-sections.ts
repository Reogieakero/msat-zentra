import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const sections = await prisma.section.findMany({
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      schoolYearId: true,
      _count: { select: { students: true, rosterEntries: true } },
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  console.log("section,grade,profiles,roster,need(roster to 20)");
  for (const s of sections) {
    const total = s._count.rosterEntries;
    console.log(
      `${s.name},${s.gradeLevel},${s._count.students},${total},${Math.max(0, 20 - total)}`,
    );
  }
  const years = await prisma.schoolYear.findMany({ select: { id: true, name: true, isActive: true } });
  console.log(JSON.stringify(years));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
