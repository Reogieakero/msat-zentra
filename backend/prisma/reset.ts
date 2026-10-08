import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const TABLES = [

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

  const sql = `TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE;`;
  await prisma.$executeRawUnsafe(sql);
  console.log("All tables cleared.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
