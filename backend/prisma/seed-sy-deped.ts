import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const SY_NAME = "SY 2026-2027";
const SY_START = new Date("2026-06-08T00:00:00Z");
const SY_END = new Date("2027-04-08T00:00:00Z");
const TERMS = [
  { n: 1, start: new Date("2026-06-08T00:00:00Z"), end: new Date("2026-09-15T00:00:00Z") },
  { n: 2, start: new Date("2026-09-16T00:00:00Z"), end: new Date("2026-12-18T00:00:00Z") },
  { n: 3, start: new Date("2027-01-04T00:00:00Z"), end: new Date("2027-04-08T00:00:00Z") },
];

async function main() {
  const principal = await prisma.user.findFirst({
    where: { role: "principal" },
    select: { id: true, email: true },
  });
  const createdBy = principal?.id ?? "system";

  let sy = await prisma.schoolYear.findFirst({ where: { name: SY_NAME } });
  if (!sy) {
    await prisma.schoolYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
    sy = await prisma.schoolYear.create({
      data: { name: SY_NAME, startDate: SY_START, endDate: SY_END, isActive: true, createdBy },
    });
    console.log(`Created ${SY_NAME} (${sy.id})`);
  } else {
    sy = await prisma.schoolYear.update({
      where: { id: sy.id },
      data: { startDate: SY_START, endDate: SY_END, isActive: true },
    });
    await prisma.schoolYear.updateMany({ where: { id: { not: sy.id }, isActive: true }, data: { isActive: false } });
    console.log(`Updated ${SY_NAME} (${sy.id})`);
  }

  for (const t of TERMS) {
    await prisma.term.upsert({
      where: { schoolYearId_termNumber: { schoolYearId: sy.id, termNumber: t.n } },
      update: { startDate: t.start, endDate: t.end },
      create: { schoolYearId: sy.id, termNumber: t.n, startDate: t.start, endDate: t.end },
    });
    console.log(`  Term ${t.n}: ${t.start.toISOString().slice(0, 10)} to ${t.end.toISOString().slice(0, 10)}`);
  }

  const check = await prisma.schoolYear.findUnique({
    where: { id: sy.id },
    include: { terms: { orderBy: { termNumber: "asc" } } },
  });
  console.log(JSON.stringify(check, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
