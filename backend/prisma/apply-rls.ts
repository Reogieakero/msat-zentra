import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const raw = readFileSync(new URL("./migrations/0001_rls.sql", import.meta.url), "utf8");
const prisma = new PrismaClient();

const drop = `
drop policy if exists anecdotal_visible on "AnecdotalRecord";
drop policy if exists anecdotal_write on "AnecdotalRecord";
drop policy if exists anecdotal_update on "AnecdotalRecord";
drop policy if exists health_visible on "HealthRecord";
drop policy if exists health_write on "HealthRecord";
drop policy if exists home_visitation_visible on "HomeVisitationRecord";
drop policy if exists home_visitation_write on "HomeVisitationRecord";
drop policy if exists adm_visible on "AdmLearnerProfile";
drop policy if exists adm_write on "AdmLearnerProfile";
drop function if exists zentra_role();
drop function if exists zentra_uid();
`;

const allSql = drop + "\n" + raw;

// Split on ';' but not inside $$ ... $$ dollar-quoted blocks (function bodies).
const statements: string[] = [];
let buf = "";
let i = 0;
while (i < allSql.length) {
  if (allSql[i] === "$" && allSql[i + 1] === "$") {
    let j = i + 2;
    while (j < allSql.length && !(allSql[j] === "$" && allSql[j + 1] === "$")) j++;
    buf += allSql.slice(i, j + 2);
    i = j + 2;
    continue;
  }
  if (allSql[i] === ";") {
    const cleaned = buf.replace(/--.*$/gm, "").trim();
    if (cleaned.length) statements.push(cleaned);
    buf = "";
    i++;
    continue;
  }
  buf += allSql[i];
  i++;
}
if (buf.trim()) statements.push(buf.replace(/--.*$/gm, "").trim());

let ok = 0;
try {
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
    ok++;
  }
  console.log(`RLS applied: ${ok}/${statements.length} statements`);
} catch (e: any) {
  console.error(`Failed at statement ${ok + 1}:`, e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
