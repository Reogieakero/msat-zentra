import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const TABLES = [
  // Quoted Postgres table names (Prisma default = model name, PascalCase).
  // Complete list of 35 models from schema.prisma — TRUNCATE CASCADE makes
  // order irrelevant and handles all FK cycles.
  '"RefreshToken"',
  '"Notification"',
  '"AuditLog"',
  '"RiskSnapshot"',
  '"ReportSnapshot"',
  '"Sf10RecordVersion"',
  '"Sf10Record"',
  '"AdmForm"',
  '"AdmDevice"',
  '"AdmModule"',
  '"AdmParentMeeting"',
  '"AdmLearnerProfile"',
  '"HomeVisitationRecord"',
  '"HealthRecord"',
  '"Intervention"',
  '"Referral"',
  '"AnecdotalRecordFollowup"',
  '"AnecdotalRecord"',
  '"AnecdotalFolder"',
  '"AttendanceRecord"',
  '"FinalGrade"',
  '"StudentGrade"',
  '"GradeFlag"',
  '"Assessment"',
  '"GradeComponent"',
  '"TeacherSubjectAssignment"',
  '"AdviserSf10AccessRequest"',
  '"StudentRoster"',
  '"Section"',
  '"Subject"',
  '"Term"',
  '"SchoolYear"',
  '"ParentStudentLink"',
  '"ParentProfile"',
  '"StudentProfile"',
  '"StaffProfile"',
  '"User"',
];

async function main() {
  // Single TRUNCATE ... CASCADE wipes everything regardless of FK order.
  // RESTART IDENTITY is harmless (uuid PKs) and resets any sequences.
  const sql = `TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE;`;
  await prisma.$executeRawUnsafe(sql);
  console.log("All tables cleared.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
