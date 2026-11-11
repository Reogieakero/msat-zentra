import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

/**
 * Creates (or resets) the system administrator account. Run after the
 * `admin_role` migration has been applied to the database.
 *
 *   npx tsx prisma/seed-admin.ts
 *
 * Credentials can be overridden with ADMIN_EMAIL / ADMIN_PASSWORD.
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@zentra.test";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin2025!";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "System Administrator";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  // The `admin_role` migration should already have run, but this makes the
  // seed safe to run on a database where it hasn't yet: adding an enum value
  // is idempotent and the migration uses the same IF NOT EXISTS guard.
  await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'admin'`);

  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { fullName: ADMIN_NAME, role: "admin", passwordHash, status: "active" },
    create: { email: ADMIN_EMAIL, fullName: ADMIN_NAME, role: "admin", passwordHash, status: "active" },
  });
  console.log(`Admin account ready: ${user.email} (role: ${user.role})`);
  console.log("Sign in at /login/admin");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
