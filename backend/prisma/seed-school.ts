import "dotenv/config";
// Entry point for `tsx prisma/seed-school.ts` (keeps prisma seed dir ESM-clean).
await import("./seed/index.js");
