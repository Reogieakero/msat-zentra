import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import argon2 from "argon2";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Teacher with no advisory section and no subject assignments yet.
const EMAIL = "teacher.noload@zentra.test";
const FULL_NAME = "Ms. Unassigned Teacher";
const PASSWORD = "Zentra2025!";
const EMPLOYEE_ID = "TCH900";

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);

  const teacher = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { fullName: FULL_NAME, role: "subject_teacher" as Role, passwordHash, status: "active" },
    create: {
      email: EMAIL,
      fullName: FULL_NAME,
      role: "subject_teacher" as Role,
      passwordHash,
      status: "active",
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: teacher.id },
    update: { employeeId: EMPLOYEE_ID, isAdviser: false, department: "Academic" },
    create: { userId: teacher.id, employeeId: EMPLOYEE_ID, isAdviser: false, department: "Academic" },
  });

  // Verify the requested starting state: no advisory, no subjects.
  const [advised, assignments] = await Promise.all([
    prisma.section.count({ where: { adviserId: teacher.id } }),
    prisma.teacherSubjectAssignment.count({ where: { teacherId: teacher.id } }),
  ]);

  console.log("Teacher ready:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`  name:     ${FULL_NAME}`);
  console.log(`  advisory sections: ${advised}`);
  console.log(`  subject assignments: ${assignments}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
