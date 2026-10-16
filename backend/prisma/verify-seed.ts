import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createPrismaAdapter } from "../src/lib/prismaAdapter.js";
const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
async function main() {
  const att = await prisma.attendanceRecord.groupBy({ by: ["status"], _count: { _all: true } });
  console.log("ATT_STATUS:" + JSON.stringify(att));
  const t2max: any[] = await prisma.$queryRawUnsafe(`SELECT MAX(date) AS m FROM "AttendanceRecord" WHERE "termId" IN (SELECT id FROM "Term" WHERE "termNumber"=2);`);
  console.log("ATT_T2_MAX:" + JSON.stringify(t2max[0]?.m));
  const badRemarks: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "FinalGrade" WHERE ("transmutedGrade" >= 75 AND remarks <> 'Passed') OR ("transmutedGrade" < 75 AND remarks <> 'Failed');`);
  console.log("FINAL_BAD_REMARKS:" + badRemarks[0]?.c);
  const badScores: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "StudentGrade" sg JOIN "Assessment" a ON a.id = sg."assessmentId" WHERE sg."rawScore" > a."maxScore" OR sg."rawScore" < 0;`);
  console.log("GRADES_OUT_OF_RANGE:" + badScores[0]?.c);
  const nullKeys: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "AnecdotalRecord" WHERE "studentId" IS NULL AND "rosterId" IS NULL;`);
  console.log("ANEC_NULL_KEYS:" + nullKeys[0]?.c);
  const admStage = await prisma.admLearnerProfile.groupBy({ by: ["stage"], _count: { _all: true } });
  console.log("ADM_STAGE:" + JSON.stringify(admStage));
  const risk = await prisma.riskSnapshot.groupBy({ by: ["riskLevel"], _count: { _all: true } });
  console.log("RISK:" + JSON.stringify(risk));
  const locks: any[] = await prisma.$queryRawUnsafe(`SELECT t."termNumber" AS term, fg."lockStatus" AS st, COUNT(*)::int AS c FROM "FinalGrade" fg JOIN "Term" t ON t.id = fg."termId" GROUP BY 1,2 ORDER BY 1,2;`);
  console.log("LOCKS:" + JSON.stringify(locks));
  const notif = await prisma.notification.groupBy({ by: ["type"], _count: { _all: true } });
  console.log("NOTIF:" + JSON.stringify(notif));
  const audit = await prisma.auditLog.groupBy({ by: ["actionType"], _count: { _all: true }, orderBy: { _count: { actionType: "desc" } }, take: 15 });
  console.log("AUDIT_TOP:" + JSON.stringify(audit));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
