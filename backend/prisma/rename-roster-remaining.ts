import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { MALE_FIRST, FEMALE_FIRST, LAST, MI } from "./data/filipino-names.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
async function main() {
  const roster = await prisma.studentRoster.findMany({ select: { id: true, fullName: true }, orderBy: { lrn: "asc" } });
  const users = await prisma.user.findMany({ where: { role: "student" }, select: { fullName: true } });
  const taken = new Set(users.map((u) => u.fullName));
  const counts = new Map<string, number>();
  for (const r of roster) counts.set(r.fullName, (counts.get(r.fullName) ?? 0) + 1);
  let fi = 0, li = 200, mi = 13, done = 0;
  for (const r of roster) {
    if ((counts.get(r.fullName) ?? 0) <= 1 && !taken.has(r.fullName)) { taken.add(r.fullName); continue; }
    for (let t = 0; t < 20000; t++) {
      const first = (fi % 2 === 0 ? MALE_FIRST : FEMALE_FIRST)[Math.floor(fi / 2) % 60];
      const cand = `${first} ${MI[(mi + t) % 26]}. ${LAST[(li + t) % LAST.length]}`;
      if (!taken.has(cand) && (counts.get(cand) ?? 0) === 0) {
        taken.add(cand);
        counts.set(r.fullName, (counts.get(r.fullName) ?? 1) - 1);
        counts.set(cand, 1);
        await prisma.studentRoster.update({ where: { id: r.id }, data: { fullName: cand } });
        done++; fi++; li++; mi++;
        break;
      }
    }
  }
  console.log(`renamed ${done} roster rows`);
  const r2 = await prisma.studentRoster.findMany({ select: { fullName: true } });
  const m = new Map<string, number>();
  for (const r of r2) m.set(r.fullName, (m.get(r.fullName) ?? 0) + 1);
  const d = [...m.entries()].filter(([, v]) => v > 1);
  const u2 = await prisma.user.findMany({ where: { role: "student" }, select: { fullName: true } });
  const all = new Set([...u2.map((u) => u.fullName), ...r2.map((r) => r.fullName)]);
  console.log(`roster total=${r2.length} unique=${m.size} dups=${d.length}`, d.slice(0, 5));
  console.log(`combined unique names=${all.size} (students=${u2.length} roster=${r2.length})`);
  await prisma.$disconnect();
  process.exit(0);
}
await main();
