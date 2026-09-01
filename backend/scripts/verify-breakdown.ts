import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
const p = new PrismaClient({ adapter: createPrismaAdapter() });
(async () => {
  const secs = await p.section.findMany({ where: { gradeLevel: { in: ["G11","G12"] } }, select: { id: true, name: true, gradeLevel: true } });
  for (const s of secs) {
    const total = await p.studentRoster.count({ where: { sectionId: s.id } });
    const lrns = (await p.studentRoster.findMany({ where: { sectionId: s.id }, select: { lrn: true } })).map((r) => r.lrn);
    const profs = await p.studentProfile.findMany({ where: { lrn: { in: lrns } }, select: { lrn: true, user: { select: { status: true } } } });
    const active = profs.filter((x) => x.user.status === "active").length;
    const pending = profs.filter((x) => x.user.status === "pending").length;
    console.log(s.gradeLevel, s.name, "total:", total, "active:", active, "pending:", pending);
  }
  const pend = await p.user.count({ where: { role: "student", status: "pending" } });
  console.log("TOTAL pending student users:", pend);
  await p.$disconnect();
})();
