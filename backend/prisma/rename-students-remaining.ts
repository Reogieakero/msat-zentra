import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { MALE_FIRST, FEMALE_FIRST, LAST, MI } from "./data/filipino-names.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const students = await prisma.user.findMany({ where: { role: "student" }, select: { id: true, fullName: true } });
  const profiles = await prisma.studentProfile.findMany({ select: { userId: true } });
  const withProfile = new Set(profiles.map((p) => p.userId));
  const taken = new Set<string>();
  for (const s of students) taken.add(s.fullName);
  // only rename dup / no-profile ones
  const counts = new Map<string, number>();
  for (const s of students) counts.set(s.fullName, (counts.get(s.fullName) ?? 0) + 1);
  const targets = students.filter((s) => !withProfile.has(s.id) || (counts.get(s.fullName) ?? 0) > 1);
  // also any remaining dup among profiled (shouldn't be, but cover)
  console.log(`targets: ${targets.length}`);
  let fi = 0, li = 100, mi = 0;
  let done = 0;
  for (const t of targets) {
    if ((counts.get(t.fullName) ?? 0) <= 1 && withProfile.has(t.id)) continue;
    for (let tries = 0; tries < 20000; tries++) {
      const first = (fi % 2 === 0 ? MALE_FIRST : FEMALE_FIRST)[Math.floor(fi / 2) % 60];
      const cand = `${first} ${MI[(mi + tries) % 26]}. ${LAST[(li + tries) % LAST.length]}`;
      if (!taken.has(cand)) {
        taken.add(cand);
        counts.set(t.fullName, (counts.get(t.fullName) ?? 1) - 1);
        counts.set(cand, 1);
        await prisma.user.update({ where: { id: t.id }, data: { fullName: cand } });
        // keep taken in sync: remove old if no longer used? keep to avoid reuse
        done++;
        fi++; li++; mi++;
        break;
      }
    }
    if (done % 10 === 0) console.log(`progress ${done}`);
  }
  console.log(`renamed ${done}`);
  // verify
  const rows = await prisma.user.findMany({ where: { role: "student" }, select: { fullName: true } });
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.fullName, (m.get(r.fullName) ?? 0) + 1);
  const dups = [...m.entries()].filter(([, v]) => v > 1);
  console.log(`total=${rows.length} unique=${m.size} dups=${dups.length}`, dups);
  await prisma.$disconnect();
  process.exit(0);
}

await main();
