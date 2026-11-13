import { prisma } from "./src/lib/prisma.js";

const userId = "d07c74ac-7ab6-4eb5-bf1f-1cc2154e71cd";
const u = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    fullName: true,
    role: true,
    staffProfile: { select: { isAdviser: true } },
    sectionsAdvised: { select: { id: true, name: true } },
  },
});
console.log(JSON.stringify(u, null, 2));
await prisma.$disconnect();
