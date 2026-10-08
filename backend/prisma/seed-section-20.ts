import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const DRY = process.argv.includes("--dry-run");
const TARGET = 20;

const FIRST = [
  "Maria", "Juan", "Ana", "Pedro", "Sofia", "Lucas", "Elena", "Miguel",
  "Rosa", "Jose", "Carmen", "Antonio", "Lucia", "Diego", "Gabriela",
  "Andres", "Isabella", "Rafael", "Paula", "Manuel", "Teresa",
];
const LAST = [
  "Santos", "Reyes", "Cruz", "Garcia", "Mendoza", "Torres", "Flores",
  "Ramos", "Diaz", "Castillo", "Manalo", "Bautista", "Villanueva",
  "Ocampo", "Aquino", "Gonzales", "Ferrer", "Salazar", "Mercado", "Aguilar",
];
const isGradeSection = (name: string) => /^G(7|8|9|10|11|12)-/i.test(name.trim());

async function main() {
  const sections = await prisma.section.findMany({
    select: { id: true, name: true, gradeLevel: true, schoolYearId: true },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  const existingLrns = new Set(
    (await prisma.studentRoster.findMany({ select: { lrn: true } })).map((r) => r.lrn),
  );

  console.log("section,have,add,skipped?");
  for (const s of sections) {
    if (!isGradeSection(s.name)) {
      const have = await prisma.studentRoster.count({ where: { sectionId: s.id } });
      console.log(`${s.name},${have},0,SKIPPED (non-grade section)`);
      continue;
    }
    const have = await prisma.studentRoster.count({ where: { sectionId: s.id } });
    const need = Math.max(0, TARGET - have);
    if (!DRY && need > 0) {
      const rows = [];
      let n = 1;
      let guard = 0;
      while (rows.length < need && guard < need * 20) {
        const tag = `${s.name.replace(/[^A-Za-z0-9]/g, "")}${String(have + rows.length + 1).padStart(2, "0")}${n > 1 ? `b${n}` : ""}`;
        const lrn = `TOP20${tag}`;
        guard++;
        if (existingLrns.has(lrn)) {
          n++;
          continue;
        }
        existingLrns.add(lrn);
        const fn = FIRST[(have + rows.length) % FIRST.length];
        const ln = LAST[(have * 3 + rows.length * 7) % LAST.length];
        rows.push({
          id: `topup20_${s.id.slice(0, 8)}_${have + rows.length + 1}`,
          lrn,
          fullName: `${fn} ${ln}`,
          gradeLevel: s.gradeLevel,
          sectionId: s.id,
          schoolYearId: s.schoolYearId,
        });
      }
      await prisma.studentRoster.createMany({ data: rows, skipDuplicates: true });
    }
    console.log(`${s.name},${have},${need},`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
