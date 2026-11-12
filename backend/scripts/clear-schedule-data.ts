/**
 * One-off cleanup: empty the schedule + teaching-assignment data behind
 * `/principal/academics/assign` and `/teacher/schedule`.
 *
 * Deletes, for every school year and every term:
 *   - `SectionTimetableEntry`      (the filled weekly schedule cells)
 *   - `TeacherSubjectAssignment`   (who teaches what, per section/term)
 *
 * Sections, advisers + advisory codes, subjects, students, grades and
 * attendance are left untouched (`AttendanceRecord.assignmentId` is
 * `onDelete: SetNull`, so existing attendance rows survive).
 *
 * Dry-run by default:
 *   npx tsx scripts/clear-schedule-data.ts
 * Apply:
 *   npx tsx scripts/clear-schedule-data.ts --apply
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";

const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const [timetableRows, assignmentRows] = await Promise.all([
    prisma.sectionTimetableEntry.count(),
    prisma.teacherSubjectAssignment.count(),
  ]);

  console.log(`SectionTimetableEntry:     ${timetableRows} row(s)`);
  console.log(`TeacherSubjectAssignment:  ${assignmentRows} row(s)`);

  if (timetableRows === 0 && assignmentRows === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (!APPLY) {
    console.log("Dry run. Re-run with --apply to delete these rows.");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const timetable = await tx.sectionTimetableEntry.deleteMany();
    const assignments = await tx.teacherSubjectAssignment.deleteMany();
    return { timetable: timetable.count, assignments: assignments.count };
  });

  console.log(
    `Deleted ${result.timetable} timetable entries and ${result.assignments} teacher-subject assignments.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
