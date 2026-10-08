import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const PER_SECTION = 5;
const FIRST = ["Maria", "Juan", "Ana", "Pedro", "Sofia", "Lucas", "Elena", "Miguel", "Rosa", "Jose"];
const LAST = ["Santos", "Reyes", "Cruz", "Garcia", "Mendoza", "Torres", "Flores", "Ramos", "Diaz", "Bautista"];

function hashNum(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

async function main() {
  const sections = await prisma.section.findMany({
    select: { id: true, name: true, gradeLevel: true, schoolYearId: true },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });
  let total = 0;
  for (const sec of sections) {
    const existing = await prisma.studentRoster.count({
      where: { sectionId: sec.id, schoolYearId: sec.schoolYearId },
    });
    const need = Math.max(0, PER_SECTION - existing);
    if (need === 0) {
      console.log(`${sec.name}: already has ${existing}, skipped`);
      continue;
    }
    const base = hashNum(sec.id);
    const rows = Array.from({ length: need }, (_, k) => {
      const i = existing + k;
      return {
        lrn: `88${String((base + i * 7919) % 100000000).padStart(8, "0")}`,
        fullName: `${FIRST[(base + i) % FIRST.length]} ${LAST[(base + i * 3) % LAST.length]}`,
        gradeLevel: sec.gradeLevel,
        sectionId: sec.id,
        schoolYearId: sec.schoolYearId,
      };
    });
    const created = await prisma.studentRoster.createMany({ data: rows, skipDuplicates: true });
    total += created.count;
    console.log(`${sec.name}: had ${existing}, added ${created.count}`);
  }
  console.log(`Done — ${total} roster rows added across ${sections.length} sections.`);
}

await main();
await prisma.$disconnect();
