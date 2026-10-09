import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { buildNamesForGenders } from "./data/filipino-names.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const students = await prisma.studentProfile.findMany({
    select: { userId: true, lrn: true, gender: true, user: { select: { email: true } } },
    orderBy: { lrn: "asc" },
  });
  console.log(`students: ${students.length}`);
  const genders = students.map((s) => (s.gender === "Female" ? "Female" as const : "Male" as const));
  const names = buildNamesForGenders(genders);
  if (new Set(names).size !== names.length) throw new Error("generated names not unique");

  const linksAll = await prisma.parentStudentLink.findMany({ select: { parentId: true, studentId: true } });
  const linksByStudent = new Map<string, string[]>();
  for (const lk of linksAll) {
    const a = linksByStudent.get(lk.studentId) ?? [];
    a.push(lk.parentId);
    linksByStudent.set(lk.studentId, a);
  }
  const CH = 20;
  for (let c = 0; c < students.length; c += CH) {
    const batch = students.slice(c, c + CH);
    await Promise.all(batch.map((s, bi) => {
      const newName = names[c + bi];
      const ops: Promise<unknown>[] = [
        prisma.user.update({ where: { id: s.userId }, data: { fullName: newName } }),
        prisma.studentRoster.updateMany({ where: { lrn: s.lrn }, data: { fullName: newName } }),
        ...(linksByStudent.get(s.userId) ?? []).map((pid) =>
          prisma.user.update({ where: { id: pid }, data: { fullName: `Parent of ${newName}` } })),
      ];
      return Promise.all(ops);
    }));
    console.log(`progress ${Math.min(c + CH, students.length)}/${students.length}`);
  }
  let n = students.length;
  // fix any roster rows without matching profile (orphans) — make unique too
  const orphans = await prisma.studentRoster.findMany({ select: { id: true, fullName: true } });
  const seen = new Set(names);
  let oi = 0;
  for (const o of orphans) {
    if (seen.has(o.fullName)) {
      let cand = `${o.fullName} ${++oi}`;
      while (seen.has(cand)) cand = `${o.fullName} ${++oi}`;
      await prisma.studentRoster.update({ where: { id: o.id }, data: { fullName: cand } });
      seen.add(cand);
    } else seen.add(o.fullName);
  }
  // verify
  const rows = await prisma.user.findMany({ where: { role: "student" }, select: { fullName: true } });
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.fullName, (m.get(r.fullName) ?? 0) + 1);
  const dups = [...m.entries()].filter(([, v]) => v > 1);
  console.log(`renamed ${n}; unique=${m.size} dups=${dups.length}`, dups.slice(0, 10));
}

await main();
await prisma.$disconnect();
