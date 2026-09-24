import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import argon2 from "argon2";

// Idempotent seeding for the hardcoded ADM Coordinator account.
// Mirrors backend/prisma/seed.ts STAFF_ACCOUNTS + STAFF_PASSWORD so a full
// seed and this targeted script never disagree on credentials.
const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const EMAIL = "adm@zentra.test";
const FULL_NAME = "Default ADM Coordinator";
const PASSWORD = "Zentra2025!";

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      fullName: FULL_NAME,
      role: "adm_coordinator",
      passwordHash,
      status: "active",
    },
    create: {
      email: EMAIL,
      fullName: FULL_NAME,
      role: "adm_coordinator",
      passwordHash,
      status: "active",
    },
  });
  await prisma.staffProfile.upsert({
    where: { userId: user.id },
    update: { employeeId: "ADM01", isAdviser: false, department: "ADM" },
    create: {
      userId: user.id,
      employeeId: "ADM01",
      isAdviser: false,
      department: "ADM",
    },
  });
  console.log(`ADM Coordinator ready:
  - email:    ${EMAIL}
  - password: ${PASSWORD}
  - portal:   staff (role=staff)
  - landing:  /coordinator/overview
  - id:       ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
