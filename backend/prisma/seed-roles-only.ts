import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient, Role } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

/**
 * Full data wipe + one seeded login per Role.
 *
 *   npx tsx prisma/seed-roles-only.ts
 *
 * Deletes every row in the public schema (including the existing principal
 * and all other accounts), then recreates exactly one active account for each
 * Role plus a fresh active school year (3 terms) so the role desks resolve a
 * term scope. Nothing else is seeded — every desk starts empty.
 *
 * Guarded: refuses production unless ALLOW_PROD_SEED=yes.
 */

const STAFF_PASSWORD = "Zentra2025!";
const STUDENT_PASSWORD = "Student2025!";
const PARENT_PASSWORD = "Parent2025!";

interface SeedAccount {
  email: string;
  fullName: string;
  role: Role;
  password: string;
  employeeId?: string;
  department?: string;
  handledGradeLevels?: ("G7" | "G8" | "G9" | "G10" | "G11" | "G12")[];
}

const ACCOUNTS: SeedAccount[] = [
  { email: "admin@zentra.test", fullName: "System Administrator", role: "admin", password: "Admin2025!" },
  { email: "principal@zentra.test", fullName: "Default Principal", role: "principal", password: STAFF_PASSWORD, employeeId: "PRN001", department: "Administration" },
  { email: "registrar@zentra.test", fullName: "Default Registrar", role: "registrar", password: STAFF_PASSWORD, employeeId: "REG001", department: "Registrar", handledGradeLevels: ["G11", "G12"] },
  { email: "record_keeper@zentra.test", fullName: "Default Record Keeper", role: "record_keeper", password: STAFF_PASSWORD, employeeId: "RKP001", department: "Records", handledGradeLevels: ["G7", "G8", "G9", "G10"] },
  { email: "nurse@zentra.test", fullName: "Default Nurse", role: "nurse", password: STAFF_PASSWORD, employeeId: "NUR001", department: "Clinic" },
  { email: "guidance_counselor@zentra.test", fullName: "Default Guidance Counselor", role: "guidance_counselor", password: STAFF_PASSWORD, employeeId: "GDC001", department: "Guidance" },
  { email: "adm_coordinator@zentra.test", fullName: "Default ADM Coordinator", role: "adm_coordinator", password: STAFF_PASSWORD, employeeId: "ADM001", department: "ADM" },
  { email: "subject_teacher@zentra.test", fullName: "Default Subject Teacher", role: "subject_teacher", password: STAFF_PASSWORD, employeeId: "TCH001", department: "Academic" },
  { email: "adviser@zentra.test", fullName: "Default Adviser", role: "adviser", password: STAFF_PASSWORD, employeeId: "ADV001", department: "Academic" },
  { email: "student@zentra.test", fullName: "Default Student", role: "student", password: STUDENT_PASSWORD },
  { email: "parent@zentra.test", fullName: "Default Parent", role: "parent", password: PARENT_PASSWORD },
];

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function wipeAll() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production" && process.env.ALLOW_PROD_SEED !== "yes") {
    throw new Error("Refusing to wipe in production without ALLOW_PROD_SEED=yes");
  }

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
  console.log(`Wipe: truncated ${tables.length} public tables.`);
}

async function main() {
  // The admin Role value may not exist on an older database yet.
  await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'admin'`);

  await wipeAll();

  for (const a of ACCOUNTS) {
    const passwordHash = await argon2.hash(a.password);
    const user = await prisma.user.create({
      data: {
        email: a.email,
        fullName: a.fullName,
        role: a.role,
        passwordHash,
        status: "active",
      },
    });

    if (a.employeeId) {
      await prisma.staffProfile.create({
        data: {
          userId: user.id,
          employeeId: a.employeeId,
          department: a.department,
          isAdviser: a.role === "adviser",
          handledGradeLevels: a.handledGradeLevels ?? [],
        },
      });
    }

    if (a.role === "student") {
      await prisma.studentProfile.create({
        data: { userId: user.id, lrn: "100000000001", gradeLevel: "G7" },
      });
    }

    if (a.role === "parent") {
      await prisma.parentProfile.create({ data: { userId: user.id } });
    }
  }

  // DepEd Order No. 009, s. 2026 — Three-Term School Calendar, SY 2026-2027.
  // SY opens 2026-06-08 and closes 2027-04-08 (201 class days). Term spans
  // include each term's end-of-term block; the Dec 19 – Jan 3 Christmas break
  // sits between Term 2 and Term 3.
  const principal = await prisma.user.findUniqueOrThrow({ where: { email: "principal@zentra.test" } });
  const schoolYear = await prisma.schoolYear.create({
    data: {
      name: "SY 2026-2027",
      startDate: new Date("2026-06-08"),
      endDate: new Date("2027-04-08"),
      isActive: true,
      createdBy: principal.id,
    },
  });
  await prisma.term.createMany({
    data: [
      { schoolYearId: schoolYear.id, termNumber: 1, startDate: new Date("2026-06-08"), endDate: new Date("2026-09-15") },
      { schoolYearId: schoolYear.id, termNumber: 2, startDate: new Date("2026-09-16"), endDate: new Date("2026-12-18") },
      { schoolYearId: schoolYear.id, termNumber: 3, startDate: new Date("2027-01-04"), endDate: new Date("2027-04-08") },
    ],
  });

  console.log("Seed complete: one account per role + active DepEd SY 2026-2027 (3 terms).");
  for (const a of ACCOUNTS) {
    console.log(`  ${a.role.padEnd(19)} ${a.email.padEnd(30)} ${a.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
