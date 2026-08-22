import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed a school year + term + a principal (hardcoded role, active).
  const schoolYear = await prisma.schoolYear.upsert({
    where: { name: "SY 2025-2026" },
    update: {},
    create: { name: "SY 2025-2026", startDate: new Date("2025-06-01"), endDate: new Date("2026-03-31"), isActive: true, createdBy: "seed" },
  });

  await prisma.term.upsert({
    where: { schoolYearId_termNumber: { schoolYearId: schoolYear.id, termNumber: 2 } },
    update: {},
    create: { schoolYearId: schoolYear.id, termNumber: 2, startDate: new Date("2025-10-01"), endDate: new Date("2025-12-12") },
  });

  console.log("Seed complete: school year + term created.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
