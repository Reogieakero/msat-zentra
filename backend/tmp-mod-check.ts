import { prisma } from "./src/lib/prisma.js";
const terms = await prisma.term.findMany({ select: { id: true, termNumber: true, startDate: true, endDate: true }, orderBy: { termNumber: "asc" } });
console.log("TERMS", JSON.stringify(terms, null, 2));
const mods = await prisma.advisoryModule.findMany({ select: { id: true, sectionId: true, kind: true, moduleName: true, createdAt: true, releaseDate: true, dueDate: true }, orderBy: { createdAt: "asc" } });
console.log("MODULES", JSON.stringify(mods, null, 2));
await prisma.$disconnect();
