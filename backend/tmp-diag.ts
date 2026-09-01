import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client.js";
import { createPrismaAdapter } from "./src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const s = process.hrtime.bigint();
  return fn().then((r) => {
    const ms = Number(process.hrtime.bigint() - s) / 1e6;
    console.log(`${label}: ${Math.round(ms)} ms`);
    return r;
  });
}

async function main() {
  const activeTerm = await time("term.findFirst", () =>
    prisma.term.findFirst({
      where: { schoolYear: { isActive: true } },
      orderBy: { termNumber: "asc" },
      select: { id: true, schoolYearId: true, termNumber: true },
    })
  );
  const termId = activeTerm?.id;
  console.log("term:", termId, "schoolYear:", activeTerm?.schoolYearId);

  const totalRecords = await time("anecdotal.count(all)", () =>
    prisma.anecdotalRecord.count()
  );
  const termRecords = await time("anecdotal.count(term)", () =>
    prisma.anecdotalRecord.count({ where: termId ? { termId } : {} })
  );
  const follows = await time("followup.count", () => prisma.anecdotalRecordFollowup.count());
  const refs = await time("referral.count", () => prisma.referral.count());
  console.log(
    "counts:", { totalRecords, termRecords, follows, refs }
  );

  const [sections, records] = await Promise.all([
    time("section.findMany(students)", () =>
      prisma.section.findMany({
        where: termId ? { schoolYearId: activeTerm!.schoolYearId } : {},
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          students: {
            select: {
              userId: true,
              lrn: true,
              user: { select: { fullName: true, status: true } },
            },
          },
        },
      })
    ),
    time("anecdotal.findMany(records, incl)", () =>
      prisma.anecdotalRecord.findMany({
        where: termId ? { termId } : {},
        select: {
          id: true,
          studentId: true,
          sectionId: true,
          observationDatetime: true,
          descriptionOfIncident: true,
          notesRecommendationsActions: true,
          category: true,
          confidentialityLevel: true,
          observer: { select: { fullName: true } },
          followups: {
            orderBy: { followupDate: "desc" },
            take: 1,
            select: { id: true },
          },
          referrals: { take: 1, orderBy: { id: "desc" }, select: { status: true } },
        },
      })
    ),
  ]);
  console.log("sections:", sections.length, "records:", records.length);
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });