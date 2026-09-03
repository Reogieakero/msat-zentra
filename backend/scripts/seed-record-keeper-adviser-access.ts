import "dotenv/config";
import { PrismaClient, GradeLevel } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const GRADE_BAND: GradeLevel[] = ["G7", "G8", "G9", "G10"];

async function main() {
  const year = await prisma.schoolYear.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!year) { console.log("no active school year"); process.exit(1); }

  const sections = await prisma.section.findMany({
    where: { gradeLevel: { in: GRADE_BAND }, schoolYearId: year.id },
    select: { id: true, gradeLevel: true, name: true, adviserId: true },
  });

  const adviserIds = sections.map((s) => s.adviserId).filter(Boolean);
  const advisers = await prisma.user.findMany({
    where: { id: { in: adviserIds } },
    select: { id: true, fullName: true },
  });
  const adviserById = new Map(advisers.map((a) => [a.id, a]));

  let created = 0;

  for (const section of sections) {
    const adviser = adviserById.get(section.adviserId);
    if (!adviser) continue;

    const statuses: Array<"pending" | "approved" | "denied"> = ["pending", "approved", "denied"];
    const chosen = statuses[Math.floor(Math.random() * statuses.length)];

    const request = await prisma.adviserSf10AccessRequest.create({
      data: {
        id: `rk_asr_${section.id}`,
        adviserId: section.adviserId,
        sectionId: section.id,
        gradeLevel: section.gradeLevel as GradeLevel,
        reason: `I need to access SF10 records for my ${section.name} advisees to review their learner documents and prepare for grade encoding.`,
        status: chosen,
        decidedBy: chosen !== "pending" ? adviser.id : null,
        decidedAt: chosen !== "pending" ? new Date() : null,
        decisionReason: chosen === "denied" ? "Requested access exceeds record-keeper scope for this band." : null,
        requestedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
      },
    });

    created++;
    console.log(`Created adviser access request: ${request.id} (${section.name} - ${chosen})`);
  }

  console.log(`\nSeeded ${created} adviser access requests for G7–10.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
