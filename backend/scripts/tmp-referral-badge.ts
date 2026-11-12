import { prisma } from "../src/lib/prisma.js";

const mode = process.argv[2] ?? "inspect";

if (mode === "inspect") {
  const a = await prisma.anecdotalRecord.findFirst({
    select: { id: true, studentId: true, rosterId: true, termId: true, observerId: true, sectionId: true },
  });
  console.log("anecdotal", a);
  const teacher = await prisma.user.findFirst({
    where: { role: "subject_teacher", status: "active" },
    select: { id: true },
  });
  console.log("teacher", teacher);
  console.log("anecdotal count", await prisma.anecdotalRecord.count());
} else if (mode === "create-referral") {
  const term = await prisma.term.findFirstOrThrow({
    where: { schoolYear: { isActive: true }, termNumber: 2 },
    select: { id: true },
  });
  const teacher = await prisma.user.findFirstOrThrow({
    where: { role: "subject_teacher", status: "active" },
    select: { id: true },
  });
  const learner = await prisma.studentProfile.findFirst({ select: { userId: true } });
  const roster = learner ? null : await prisma.studentRoster.findFirst({ select: { id: true } });
  const section = await prisma.section.findFirstOrThrow({ select: { id: true } });

  const record = await prisma.anecdotalRecord.create({
    data: {
      ...(learner ? { studentId: learner.userId } : { rosterId: roster!.id }),
      observerId: teacher.id,
      sectionId: section.id,
      termId: term.id,
      observationDatetime: new Date(),
      descriptionOfIncident: `badge test ${Date.now()}`,
      category: "behavioral",
      confidentialityLevel: "restricted",
    },
    select: { id: true },
  });
  const referral = await prisma.referral.create({
    data: {
      anecdotalRecordId: record.id,
      referredToRole: "guidance_counselor",
      referredBy: teacher.id,
      reason: `badge test referral ${Date.now()}`,
      termId: term.id,
      status: "pending",
      ...(learner ? { studentId: learner.userId } : { rosterId: roster!.id }),
    },
    select: { id: true },
  });
  console.log(JSON.stringify(referral));
}

await prisma.$disconnect();
