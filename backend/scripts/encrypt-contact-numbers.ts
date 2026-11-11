/**
 * One-off backfill: encrypt every plaintext `User.contactNumber` with
 * AES-256-GCM (see `src/lib/contact-crypto.ts`). Requires
 * `CONTACT_ENCRYPTION_KEY` — the same key the API uses to read them back.
 *
 * Dry-run by default:
 *   npx tsx scripts/encrypt-contact-numbers.ts
 * Apply:
 *   npx tsx scripts/encrypt-contact-numbers.ts --apply
 *
 * Rows already carrying the `v1:` marker are skipped, so the script is safe to
 * re-run.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { encryptContact, isEncryptedContact } from "../src/lib/contact-crypto.js";

const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const users = await prisma.user.findMany({
    where: { contactNumber: { not: null } },
    select: { id: true, email: true, contactNumber: true },
  });

  const pending = users.filter((u) => !isEncryptedContact(u.contactNumber));
  console.log(
    `Scanned ${users.length} contact number(s); ${pending.length} still plaintext.` +
      (APPLY ? "" : " Dry-run — pass --apply to encrypt."),
  );

  let updated = 0;
  for (const user of pending) {
    const encrypted = encryptContact(user.contactNumber);
    if (!encrypted) continue;
    console.log(`  ${user.email}: encrypting`);
    if (APPLY) {
      await prisma.user.update({ where: { id: user.id }, data: { contactNumber: encrypted } });
    }
    updated += 1;
  }

  console.log(APPLY ? `Encrypted ${updated} row(s).` : `Would encrypt ${updated} row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
