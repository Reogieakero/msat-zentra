import { prisma } from "./src/lib/prisma.js";
import { signAccess } from "./src/lib/jwt.js";

const adviser = await prisma.user.findFirst({ where: { role: "adviser" }, select: { id: true, email: true } });
console.log("adviser", adviser);
const token = signAccess({ sub: adviser!.id, role: "adviser", gradeBand: null });
const res = await fetch(
  "http://localhost:4000/api/attendance/section-subject-matrix?sectionId=52a70093-f59b-48f5-b2a9-140a7800ce33",
  { headers: { Authorization: `Bearer ${token}` } },
);
console.log(res.status);
console.log(await res.text());
await prisma.$disconnect();
