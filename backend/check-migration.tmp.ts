import { prisma } from "./src/lib/prisma.ts";

const cols = await prisma.$queryRaw<{ column_name: string }[]>`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'Section' AND column_name = 'adviserLabel'
`;
console.log("ADVISER_LABEL_EXISTS:" + (cols.length > 0));

const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
  SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 5
`;
console.log("RECENT_MIGRATIONS:" + JSON.stringify(applied.map((r) => r.migration_name)));

await prisma.$disconnect();
