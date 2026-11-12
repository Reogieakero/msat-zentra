/**
 * One-off purge: remove every piece of school data while keeping accounts.
 *
 * KEPT (never touched):
 *   - `User` (every login account)
 *   - `StudentProfile`, `ParentProfile`, `StaffProfile` (account profiles)
 *   - `ParentStudentLink` (parent ↔ child account links)
 *   - `SchoolYear`, `Term` (system calendar — the app needs it to resolve scope)
 *   - `RefreshToken` (active logins stay valid)
 *
 * DELETED (all rows, all years/terms):
 *   sections, subjects, rosters, timetables, teaching assignments, gradebooks,
 *   attendance, anecdotal records, referrals/counseling, interventions, health +
 *   home-visit records, every ADM case, advisory modules, SF10 records,
 *   grade flags, risk + report snapshots, adviser access requests, audit log,
 *   notifications, login events.
 *
 * `StudentProfile.sectionId` is nulled first so student accounts survive the
 * section delete.
 *
 * Dry-run by default:
 *   npx tsx scripts/purge-system-data.ts
 * Apply:
 *   npx tsx scripts/purge-system-data.ts --apply
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const APPLY = process.argv.includes("--apply");

// Child-first: every table here is deleted before anything it references.
const DELETE_ORDER = [
  "ClinicSessionAttachment",
  "CounselingSession",
  "AdmMeetingAttachment",
  "AdmMeetingInvitee",
  "AdmParentMeeting",
  "AdmModule",
  "AdmDevice",
  "AdmForm",
  "AdmLearnerProfile",
  "HealthRecord",
  "HomeVisitationRecord",
  "Intervention",
  "Referral",
  "AnecdotalRecordFollowup",
  "AnecdotalRecord",
  "AnecdotalFolder",
  "AdvisoryModuleSubmission",
  "AdvisoryModule",
  "Sf10RecordVersion",
  "Sf10Record",
  "AdviserSf10AccessRequest",
  "GradeFlag",
  "StudentGrade",
  "Assessment",
  "GradeComponent",
  "FinalGrade",
  "AttendanceRecord",
  "AttendanceRecordLegacy",
  "SectionTimetableEntry",
  "TeacherSubjectAssignment",
  "ScheduleConfig",
  "TeacherTermGrant",
  "AdviserArchivedStudent",
  "TermRosterConfirmation",
  "RiskSnapshot",
  "ReportSnapshot",
  "StudentRoster",
  "TeacherName",
  "Section",
  "Subject",
  "AuditLog",
  "Notification",
  "LoginEvent",
] as const;

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const counts: { table: string; count: number }[] = [];
  for (const table of DELETE_ORDER) {
    const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM "${table}"`,
    );
    counts.push({ table, count: rows[0]?.count ?? 0 });
  }

  const total = counts.reduce((sum, c) => sum + c.count, 0);
  for (const { table, count } of counts) {
    console.log(`${table.padEnd(30)} ${String(count).padStart(8)}`);
  }
  console.log(`\n${total} row(s) across ${DELETE_ORDER.length} tables.`);

  if (total === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (!APPLY) {
    console.log("Dry run. Re-run with --apply to delete these rows.");
    return;
  }

  const deleted = await prisma.$transaction(async (tx) => {
    // Keep student accounts but detach them from the sections about to go.
    const detached = await tx.$executeRawUnsafe(
      `UPDATE "StudentProfile" SET "sectionId" = NULL WHERE "sectionId" IS NOT NULL`,
    );
    let removed = 0;
    for (const table of DELETE_ORDER) {
      removed += await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }
    return { detached, removed };
  });

  console.log(
    `Done. Detached ${deleted.detached} student profile(s) from sections; deleted ${deleted.removed} row(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
