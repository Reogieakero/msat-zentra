import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const WIPES: string[] = [
  '"RefreshToken"',
  '"Notification"',
  '"AuditLog"',
  '"ClinicSessionAttachment"',
  '"CounselingSession"',
  '"AdmForm"',
  '"AdmDevice"',
  '"AdmModule"',
  '"AdmParentMeeting"',
  '"AdmLearnerProfile"',
  '"HealthRecord"',
  '"HomeVisitationRecord"',
  '"Intervention"',
  '"Referral"',
  '"AnecdotalRecordFollowup"',
  '"AnecdotalRecord"',
  '"AnecdotalFolder"',
  '"AttendanceRecordLegacy"',
  '"AttendanceRecord"',
  '"FinalGrade"',
  '"StudentGrade"',
  '"GradeFlag"',
  '"Assessment"',
  '"GradeComponent"',
  '"TeacherSubjectAssignment"',
  '"AdviserSf10AccessRequest"',
  '"RiskSnapshot"',
  '"Sf10RecordVersion"',
  '"Sf10Record"',
  '"ReportSnapshot"',
  '"StudentRoster"',
  '"ParentStudentLink"',
  '"Section"',
  '"Term"',
  '"ParentProfile"',
  '"StudentProfile"',
  '"Subject"',
  '"SchoolYear"',
];

async function countAll(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const tables = [...WIPES, '"StaffProfile"', '"User"'];
  for (const t of tables) {
    try {
      const r = (await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c FROM ${t};`,
      )) as { c: number }[];
      out[t.replace(/"/g, "")] = r[0]?.c ?? -1;
    } catch {
      out[t.replace(/"/g, "")] = -1;
    }
  }
  try {
    const roles = (await prisma.$queryRawUnsafe(
      `SELECT role::text AS role, COUNT(*)::int AS c FROM "User" GROUP BY role ORDER BY role;`,
    )) as { role: string; c: number }[];
    for (const r of roles) out[`User:${r.role}`] = r.c;
  } catch {  }
  return out;
}

async function main() {
  console.log("BEFORE:");
  console.table(await countAll());

  for (const t of WIPES) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${t};`);
    console.log(`  wiped ${t}`);
  }

  const del = await prisma.$executeRawUnsafe(
    `DELETE FROM "User" WHERE role IN ('student', 'parent');`,
  );
  console.log(`  deleted ${del} student/parent User rows (profiles cascaded)`);

  console.log("\nAFTER:");
  console.table(await countAll());
  console.log("Done. Staff accounts preserved, everything else is 0.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
