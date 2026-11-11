import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const years = await prisma.schoolYear.findMany({
    select: { id: true, name: true, isActive: true, terms: { select: { id: true, termNumber: true, startDate: true, endDate: true } } },
  });
  console.log("years", JSON.stringify(years, null, 2));

  const byStatus = await prisma.referral.groupBy({
    by: ["status", "referredToRole"],
    _count: { _all: true },
  });
  console.log("referrals", JSON.stringify(byStatus, null, 2));

  const interventions = await prisma.intervention.groupBy({
    by: ["outcomeStatus", "termId"],
    _count: { _all: true },
  });
  console.log("interventions", JSON.stringify(interventions, null, 2));

  const recentReferrals = await prisma.referral.findMany({
    orderBy: { anecdotalRecord: undefined },
    take: 5,
    select: { id: true, status: true, referredToRole: true, termId: true, consultReviewer: true, escalatedTo: true },
  });
  console.log("recent referrals", JSON.stringify(recentReferrals, null, 2));

  const users = await prisma.user.findMany({
    where: { role: "guidance_counselor" },
    select: { id: true, email: true, fullName: true, status: true },
  });
  console.log("counselors", JSON.stringify(users, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
