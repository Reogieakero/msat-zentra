import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TABLES = [
  "ReportSnapshot",
  "Notification",
  "AuditLog",
  "RiskSnapshot",
  "Sf10RecordVersion",
  "Sf10Record",
  "AdmDevice",
  "AdmModule",
  "AdmParentMeeting",
  "AdmLearnerProfile",
  "HomeVisitationRecord",
  "HealthRecord",
  "Intervention",
  "Referral",
  "AnecdotalRecordFollowup",
  "AnecdotalRecord",
  "AttendanceRecord",
  "FinalGrade",
  "StudentGrade",
  "Assessment",
  "GradeComponent",
  "TeacherSubjectAssignment",
  "Section",
  "Subject",
  "Term",
  "SchoolYear",
  "ParentStudentLink",
  "ParentProfile",
  "StudentProfile",
  "StaffProfile",
  "RefreshToken",
  "User",
];

async function main() {
  for (const t of TABLES) {
    await (prisma as any)[t.charAt(0).toLowerCase() + t.slice(1)].deleteMany({});
  }
  console.log("All tables cleared.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
