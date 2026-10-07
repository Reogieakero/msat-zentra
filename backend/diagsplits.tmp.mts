import { prisma } from "./src/lib/prisma.js";

const term = await prisma.term.findFirst({ where: { termNumber: 2 }, select: { id: true } });
const entries = await prisma.sectionTimetableEntry.findMany({
  where: { termId: term!.id },
  select: {
    section: { select: { name: true } },
    subject: { select: { name: true } },
    teacherName: { select: { name: true } },
  },
});
const groups = new Map<string, Set<string>>();
for (const e of entries) {
  const key = `${e.section.name} | ${e.subject.name}`;
  if (!groups.has(key)) groups.set(key, new Set());
  groups.get(key)!.add(e.teacherName?.name ?? "(none)");
}
let split = 0;
for (const [key, teachers] of [...groups.entries()].sort()) {
  if (teachers.size > 1) {
    split += 1;
    console.log(`${key} => ${[...teachers].join(", ")}`);
  }
}
console.log(`split pairs: ${split} of ${groups.size}`);
await prisma.$disconnect();
