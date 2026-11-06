import { prisma } from "./src/lib/prisma.js";

async function main() {
  const profiles = await prisma.studentProfile.findMany({
    where: {
      OR: [
        { lrn: "101456025233" },
        { user: { fullName: { contains: "Jones", mode: "insensitive" } } },
        { user: { fullName: { contains: "Tammy", mode: "insensitive" } } },
      ],
    },
    select: {
      userId: true,
      lrn: true,
      gradeLevel: true,
      user: { select: { fullName: true } },
      section: { select: { name: true } },
    },
    take: 20,
  });
  const roster = await prisma.studentRoster.findMany({
    where: {
      OR: [
        { lrn: "101456025233" },
        { fullName: { contains: "Jones", mode: "insensitive" } },
        { fullName: { contains: "Tammy", mode: "insensitive" } },
      ],
    },
    select: { id: true, lrn: true, fullName: true, gradeLevel: true, sectionId: true },
    take: 20,
  });
  console.log("PROFILES:", JSON.stringify(profiles, null, 1));
  console.log("ROSTER:", JSON.stringify(roster, null, 1));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("LOOKUP_FAILED:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
