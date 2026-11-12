import { prisma } from "../src/lib/prisma.js";

const id = process.argv[2];
const note = process.argv[3] ?? `bump-${Date.now()}`;

const row = id
  ? await prisma.intervention.findUniqueOrThrow({ where: { id } })
  : (await prisma.intervention.findFirstOrThrow({ where: { outcomeStatus: "ongoing" } }));

const updated = await prisma.intervention.update({
  where: { id: row.id },
  data: { intakeNotes: note },
});
console.log(JSON.stringify({ id: updated.id, note }));
await prisma.$disconnect();
