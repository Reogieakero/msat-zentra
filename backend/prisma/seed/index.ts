import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../../src/lib/prismaAdapter.js";
import { SEED, SIZE, DRY, WIPE, SY_NAME } from "./config.js";
import { Rng } from "./utils/rng.js";
import { wipeForReseed } from "./wipe.js";
import { seedCore } from "./seeders/00-core.js";
import { seedAcademic } from "./seeders/01-academic.js";
import { seedRoster } from "./seeders/02-roster.js";
import { seedGradebook } from "./seeders/03-gradebook.js";
import { seedAttendance } from "./seeders/04-attendance.js";
import { seedBehavioral } from "./seeders/05-behavioral.js";
import { seedHealthHome } from "./seeders/06-health-home.js";
import { seedAdm } from "./seeders/07-adm.js";
import { seedSf10Flags } from "./seeders/08-sf10-flags.js";
import { seedNotifyAuditRisk } from "./seeders/09-notify-audit-risk.js";

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const t0 = Date.now();
  console.log(`ZENTRA school seed: SY=${SY_NAME} SIZE=${SIZE} SEED=${SEED} DRY=${DRY} WIPE=${WIPE}`);
  const rng = new Rng(SEED);

  if (WIPE && !DRY) {
    await wipeForReseed(prisma);
  } else if (!WIPE && !DRY) {
    console.log("WIPE=0: running additive (existing T1/T2 rows kept; reruns may duplicate transactional). Set SEED_WIPE=1 for clean reseed.");
  }

  const core = await seedCore(prisma);
  const acad = await seedAcademic(prisma, core, rng);
  const roster = await seedRoster(prisma, core, acad, rng);
  const grades = await seedGradebook(prisma, core, acad, roster, rng);
  const attend = await seedAttendance(prisma, core, acad, roster, rng);
  const behav = await seedBehavioral(prisma, core, acad, roster, rng);
  await seedHealthHome(prisma, core, roster, behav, rng);
  await seedAdm(prisma, core, acad, roster, behav, rng);
  await seedSf10Flags(prisma, core, acad, roster, rng);
  await seedNotifyAuditRisk(prisma, core, acad, roster, grades, attend, behav, rng);

  if (!DRY) {
    const counts: Record<string, number> = {};
    const tables: [string, any][] = [
      ["StudentRoster", prisma.studentRoster],
      ["StudentProfile", prisma.studentProfile],
      ["Section", prisma.section],
      ["Subject", prisma.subject],
      ["TeacherSubjectAssignment", prisma.teacherSubjectAssignment],
      ["Assessment", prisma.assessment],
      ["StudentGrade", prisma.studentGrade],
      ["FinalGrade", prisma.finalGrade],
      ["AttendanceRecord", prisma.attendanceRecord],
      ["AnecdotalRecord", prisma.anecdotalRecord],
      ["Referral", prisma.referral],
      ["CounselingSession", prisma.counselingSession],
      ["Intervention", prisma.intervention],
      ["HealthRecord", prisma.healthRecord],
      ["HomeVisitationRecord", prisma.homeVisitationRecord],
      ["AdmLearnerProfile", prisma.admLearnerProfile],
      ["AdmModule", prisma.admModule],
      ["AdmDevice", prisma.admDevice],
      ["AdmForm", prisma.admForm],
      ["Sf10Record", prisma.sf10Record],
      ["Notification", prisma.notification],
      ["AuditLog", prisma.auditLog],
      ["RiskSnapshot", prisma.riskSnapshot],
      ["ReportSnapshot", prisma.reportSnapshot],
    ];
    for (const [name, model] of tables) {
      try {
        counts[name] = await model.count();
      } catch {
        counts[name] = -1;
      }
    }
    console.log("Final counts:");
    console.table(counts);
  }
  console.log(`Done in ${Math.round((Date.now() - t0) / 1000)}s`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
