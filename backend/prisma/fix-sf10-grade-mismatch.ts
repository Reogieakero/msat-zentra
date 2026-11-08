import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
import { GRADE_BAND_7_10 } from "../src/lib/roles.js";

/**
 * One-off repair: StudentProfile.gradeLevel lags behind the learner's current
 * advisory section (e.g. registered as G8, then enlisted into a G7 section).
 * SF10 trusts the profile field, so the record was labelled/auto-filled with
 * the wrong grade.
 *
 * For every profile in an active-school-year section whose grade differs, set
 * it to the section's grade and — when the grade crosses the JHS/SHS band —
 * move the learner's SF10 record to the desk that owns the new band (only when
 * the target desk has no record yet for that student).
 *
 * Dry-run by default. Pass `--apply` to write.
 */

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const APPLY = process.argv.includes("--apply");

interface Sf10RecordFan {
  ocrExtractedData: unknown;
  versions: Array<{ dataSnapshot: unknown; changeReason: string }>;
}

interface Sf10Payload {
  subjects?: Array<{ norm: string; gradeLevel?: string | null }>;
  [key: string]: unknown;
}

/**
 * Only touch rows the auto-fill itself mis-tagged: the latest version must be
 * an auto-fill run, and the old-grade row must duplicate a subject already
 * present at the corrected grade. Uploaded historical blocks (different norms)
 * are left alone.
 */
function wrongGradeRows(rec: Sf10RecordFan, oldGrade: string, newGrade: string) {
  if (oldGrade === newGrade) return [] as number[];
  const latest = rec.versions[0];
  const snapshot = latest?.dataSnapshot as Sf10Payload | null;
  if (snapshot?.engine !== "grading-auto-fill-v1") return [] as number[];

  const payload = rec.ocrExtractedData as Sf10Payload | null;
  const subjects = payload?.subjects ?? [];
  const normsAtNew = new Set(
    subjects.filter((s) => s.gradeLevel === newGrade).map((s) => s.norm),
  );
  return subjects
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.gradeLevel === oldGrade && normsAtNew.has(s.norm))
    .map(({ i }) => i);
}

function prunableRows(rec: Sf10RecordFan, oldGrade: string, newGrade: string): number {
  return wrongGradeRows(rec, oldGrade, newGrade).length;
}

function prunePayload(rec: Sf10RecordFan, oldGrade: string, newGrade: string): Sf10Payload | null {
  const drop = new Set(wrongGradeRows(rec, oldGrade, newGrade));
  if (drop.size === 0) return null;
  const payload = rec.ocrExtractedData as Sf10Payload;
  return {
    ...payload,
    subjects: (payload.subjects ?? []).filter((_, i) => !drop.has(i)),
  };
}

async function main() {
  const year = await prisma.schoolYear.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (!year) throw new Error("No active school year");

  const sections = await prisma.section.findMany({
    where: { schoolYearId: year.id },
    select: { id: true, name: true, gradeLevel: true, adviserId: true },
  });
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  const profiles = await prisma.studentProfile.findMany({
    where: { sectionId: { in: sections.map((s) => s.id) } },
    select: {
      userId: true,
      lrn: true,
      gradeLevel: true,
      sectionId: true,
      user: { select: { fullName: true } },
      sf10Records: {
        select: {
          id: true,
          desk: true,
          currentVersion: true,
          ocrExtractedData: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { versionNumber: true, changeReason: true, dataSnapshot: true },
          },
        },
      },
    },
  });

  const mismatched = profiles.filter(
    (p) => p.sectionId && sectionById.get(p.sectionId)?.gradeLevel !== p.gradeLevel,
  );

  if (mismatched.length === 0) {
    console.log(`No grade mismatches in ${year.name}. Nothing to repair.`);
    return;
  }

  for (const p of mismatched) {
    const section = sectionById.get(p.sectionId as string)!;
    const targetDesk = (GRADE_BAND_7_10 as string[]).includes(section.gradeLevel)
      ? "record_keeper"
      : "registrar";
    console.log(
      `${APPLY ? "" : "[dry] "}${p.user.fullName} (${p.lrn}) profile=${p.gradeLevel} → ${section.gradeLevel}` +
        ` · section ${section.name}`,
    );
    for (const rec of p.sf10Records) {
      const move = rec.desk !== targetDesk ? ` · desk ${rec.desk} → ${targetDesk}` : "";
      const prunable = prunableRows(rec, p.gradeLevel, section.gradeLevel);
      const pruneNote =
        prunable > 0
          ? ` · removes ${prunable} auto-filled row(s) tagged ${p.gradeLevel}`
          : "";
      console.log(
        `    record ${rec.id} (v${rec.currentVersion})${move || " · desk unchanged"}${pruneNote}`,
      );
    }

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({
        where: { userId: p.userId },
        data: { gradeLevel: section.gradeLevel as never },
      });
      for (const rec of p.sf10Records) {
        if (rec.desk !== targetDesk) {
          const conflict = await tx.sf10Record.findUnique({
            where: { studentId_desk: { studentId: p.userId, desk: targetDesk as never } },
            select: { id: true },
          });
          if (conflict) {
            console.log(
              `    ! ${p.lrn}: kept record under ${rec.desk} — a ${targetDesk} record already exists`,
            );
          } else {
            await tx.sf10Record.update({
              where: { id: rec.id },
              data: { desk: targetDesk as never },
            });
          }
        }
        const pruned = prunePayload(rec, p.gradeLevel, section.gradeLevel);
        if (!pruned) continue;
        const actor = section.adviserId ?? p.userId;
        const nextVersion = rec.currentVersion + 1;
        const reason = `Removed auto-fill rows tagged ${p.gradeLevel} after grade sync to ${section.gradeLevel}`;
        await tx.sf10Record.update({
          where: { id: rec.id },
          data: {
            ocrExtractedData: pruned as never,
            currentVersion: nextVersion,
          },
        });
        await tx.sf10RecordVersion.create({
          data: {
            sf10RecordId: rec.id,
            versionNumber: nextVersion,
            dataSnapshot: pruned as never,
            changedBy: actor,
            changeReason: reason,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: actor,
            actionType: "sf10_update",
            sourceTable: "sf10_records",
            sourceId: rec.id,
            reason,
          },
        });
      }
    });
    console.log("    updated");
  }

  console.log(
    `${APPLY ? "done" : "[dry] no writes performed"}: ${mismatched.length} profile(s)` +
      `${APPLY ? " repaired" : " need repair"}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
