import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

/**
 * Seeds five pending G7–G10 student accounts for the record keeper's
 * Account approvals desk (`/record-keeper/accounts` →
 * `GET /api/auth/pending`).
 *
 * Each row is a `User` with `status: pending` + `role: student` and a matching
 * `StudentProfile` (grade band G7–G10, no section so they never leak into
 * active class rosters). Idempotent: re-running updates the same accounts
 * (matched by email) instead of duplicating them.
 *
 * Sign in with any seeded email and `Student2025!` once approved.
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const PASSWORD = "Student2025!";
const EMAIL_DOMAIN = "pending.students.zentra.test";

const STUDENTS = [
  {
    lrn: "136120260001",
    fullName: "Althea Marie Bautista",
    gradeLevel: "G7",
    gender: "Female",
    birthdate: "2014-03-12",
    address: "24 Mabini St., Brgy. San Isidro, Quezon City",
    contactNumber: "09171234001",
    daysAgo: 0,
  },
  {
    lrn: "136120260002",
    fullName: "Joaquin Reyes Delgado",
    gradeLevel: "G8",
    gender: "Male",
    birthdate: "2013-07-28",
    address: "88 Rizal Ave., Brgy. Poblacion, Quezon City",
    contactNumber: "09171234002",
    daysAgo: 1,
  },
  {
    lrn: "136120260003",
    fullName: "Kimberly Anne Santos",
    gradeLevel: "G9",
    gender: "Female",
    birthdate: "2012-11-05",
    address: "5 Luna St., Brgy. Sta. Cruz, Quezon City",
    contactNumber: "09171234003",
    daysAgo: 2,
  },
  {
    lrn: "136120260004",
    fullName: "Rafael Luis Mendoza",
    gradeLevel: "G10",
    gender: "Male",
    birthdate: "2011-01-19",
    address: "117 Bonifacio St., Brgy. Bagong Pag-asa, Quezon City",
    contactNumber: "09171234004",
    daysAgo: 3,
  },
  {
    lrn: "136120260005",
    fullName: "Sofia Isabel Navarro",
    gradeLevel: "G7",
    gender: "Female",
    birthdate: "2014-09-23",
    address: "31 Katipunan Ave., Brgy. Milagrosa, Quezon City",
    contactNumber: "09171234005",
    daysAgo: 4,
  },
] as const;

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);
  const now = Date.now();

  for (const s of STUDENTS) {
    const email = `${s.lrn}@${EMAIL_DOMAIN}`;
    const createdAt = new Date(now - s.daysAgo * 24 * 60 * 60 * 1000);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        fullName: s.fullName,
        role: "student",
        status: "pending",
        lrn: s.lrn,
        contactNumber: s.contactNumber,
        passwordHash,
      },
      create: {
        email,
        passwordHash,
        role: "student",
        fullName: s.fullName,
        lrn: s.lrn,
        status: "pending",
        contactNumber: s.contactNumber,
        createdAt,
      },
      select: { id: true },
    });

    const profile = {
      lrn: s.lrn,
      gradeLevel: s.gradeLevel,
      birthdate: new Date(`${s.birthdate}T00:00:00.000Z`),
      gender: s.gender,
      address: s.address,
    };

    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: profile,
      create: { userId: user.id, ...profile },
    });

    console.log(`pending student ready: ${s.fullName} (${s.gradeLevel}) <${email}>`);
  }

  const pending = await prisma.user.count({
    where: { role: "student", status: "pending" },
  });
  console.log(`Done: ${STUDENTS.length} pending student accounts seeded (total pending students: ${pending}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
