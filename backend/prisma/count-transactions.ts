import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// Row counts for every transaction table (config/identity tables excluded).
const COUNTERS: Record<string, () => Promise<number>> = {
  StudentGrade: () => prisma.studentGrade.count(),
  FinalGrade: () => prisma.finalGrade.count(),
  Assessment: () => prisma.assessment.count(),
  GradeFlag: () => prisma.gradeFlag.count(),
  AttendanceRecord: () => prisma.attendanceRecord.count(),
  AttendanceRecordLegacy: () => prisma.attendanceRecordLegacy.count(),
  AnecdotalRecord: () => prisma.anecdotalRecord.count(),
  AnecdotalFolder: () => prisma.anecdotalFolder.count(),
  AnecdotalRecordFollowup: () => prisma.anecdotalRecordFollowup.count(),
  Referral: () => prisma.referral.count(),
  CounselingSession: () => prisma.counselingSession.count(),
  ClinicSessionAttachment: () => prisma.clinicSessionAttachment.count(),
  Intervention: () => prisma.intervention.count(),
  HealthRecord: () => prisma.healthRecord.count(),
  HomeVisitationRecord: () => prisma.homeVisitationRecord.count(),
  AdmLearnerProfile: () => prisma.admLearnerProfile.count(),
  AdmParentMeeting: () => prisma.admParentMeeting.count(),
  AdmMeetingInvitee: () => prisma.admMeetingInvitee.count(),
  AdmMeetingAttachment: () => prisma.admMeetingAttachment.count(),
  AdmModule: () => prisma.admModule.count(),
  AdmDevice: () => prisma.admDevice.count(),
  AdmForm: () => prisma.admForm.count(),
  Sf10Record: () => prisma.sf10Record.count(),
  Sf10RecordVersion: () => prisma.sf10RecordVersion.count(),
  AdviserSf10AccessRequest: () => prisma.adviserSf10AccessRequest.count(),
  AdviserArchivedStudent: () => prisma.adviserArchivedStudent.count(),
  AuditLog: () => prisma.auditLog.count(),
  RiskSnapshot: () => prisma.riskSnapshot.count(),
  ReportSnapshot: () => prisma.reportSnapshot.count(),
  Notification: () => prisma.notification.count(),
  TeacherTermGrant: () => prisma.teacherTermGrant.count(),
  TeacherName: () => prisma.teacherName.count(),
  ScheduleConfig: () => prisma.scheduleConfig.count(),
  SectionTimetableEntry: () => prisma.sectionTimetableEntry.count(),
};

async function main() {
  const rows: { table: string; count: number; deficit: number }[] = [];
  for (const [table, fn] of Object.entries(COUNTERS)) {
    const count = await fn();
    rows.push({ table, count, deficit: Math.max(0, 50 - count) });
  }
  rows.sort((a, b) => a.count - b.count);
  console.log("table,count,deficit");
  for (const r of rows) console.log(`${r.table},${r.count},${r.deficit}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
