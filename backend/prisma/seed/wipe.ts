import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../../src/lib/prismaAdapter.js";

// Scoped wipe for school-scale reseed. Preserves staff Users + SchoolYear/Term.
// Guarded: refuses production unless ALLOW_PROD_SEED=yes.
const CHILD_FIRST = [
  '"RefreshToken"',
  '"Notification"',
  '"AuditLog"',
  '"ClinicSessionAttachment"',
  '"AdmMeetingAttachment"',
  '"AdmMeetingInvitee"',
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
  '"AttendanceRecord"',
  '"AttendanceRecordLegacy"',
  '"StudentGrade"',
  '"Assessment"',
  '"GradeComponent"',
  '"FinalGrade"',
  '"GradeFlag"',
  '"RiskSnapshot"',
  '"ReportSnapshot"',
  '"Sf10RecordVersion"',
  '"Sf10Record"',
  '"AdviserSf10AccessRequest"',
  '"TeacherSubjectAssignment"',
  '"SectionTimetableEntry"',
  '"ScheduleConfig"',
  '"TeacherTermGrant"',
  '"AdviserArchivedStudent"',
  '"ParentStudentLink"',
  '"StudentProfile"',
  '"ParentProfile"',
  // NOTE: StaffProfile preserved (staff users kept).
  '"StudentRoster"',
  '"Section"',
  '"Subject"',
  '"TeacherName"',
];

export async function wipeForReseed(prisma: PrismaClient) {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production" && process.env.ALLOW_PROD_SEED !== "yes") {
    throw new Error("Refusing to wipe in production without ALLOW_PROD_SEED=yes");
  }
  console.log("Wipe: deleting transactional tables (staff + SY/terms preserved)...");
  for (const t of CHILD_FIRST) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${t};`);
  }
  const del = await prisma.$executeRawUnsafe(
    `DELETE FROM "User" WHERE role IN ('student', 'parent');`,
  );
  console.log(`Wipe: deleted ${del} student/parent users (profiles cascaded).`);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
  wipeForReseed(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
