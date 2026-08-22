import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const STAFF_PASSWORD = "Zentra2025!";

const STAFF_ACCOUNTS = [
  { email: "principal@zentra.test", fullName: "Default Principal", role: "principal" as const },
  { email: "registrar@zentra.test", fullName: "Default Registrar", role: "registrar" as const },
  { email: "record_keeper@zentra.test", fullName: "Default Record Keeper", role: "record_keeper" as const },
  { email: "nurse@zentra.test", fullName: "Default Nurse", role: "nurse" as const },
  { email: "guidance@zentra.test", fullName: "Default Guidance Counselor", role: "guidance_counselor" as const },
];

async function main() {
  // Seed a school year + term. createdBy is a plain string field (no FK).
  let schoolYear = await prisma.schoolYear.findFirst({ where: { name: "SY 2025-2026" } });
  if (!schoolYear) {
    schoolYear = await prisma.schoolYear.create({
      data: { name: "SY 2025-2026", startDate: new Date("2025-06-01"), endDate: new Date("2026-03-31"), isActive: true, createdBy: "seed" },
    });
  }

  await prisma.term.upsert({
    where: { schoolYearId_termNumber: { schoolYearId: schoolYear.id, termNumber: 2 } },
    update: {},
    create: { schoolYearId: schoolYear.id, termNumber: 2, startDate: new Date("2025-10-01"), endDate: new Date("2025-12-12") },
  });

  const passwordHash = await argon2.hash(STAFF_PASSWORD);
  for (const acc of STAFF_ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: acc.email },
      update: { fullName: acc.fullName, role: acc.role, passwordHash, status: "active" },
      create: { email: acc.email, fullName: acc.fullName, role: acc.role, passwordHash, status: "active" },
    });
  }

  console.log("Seed complete: school year + term + staff accounts created.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
