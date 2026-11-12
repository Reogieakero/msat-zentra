import { prisma } from "./src/lib/prisma.js";
import { getSectionStats } from "./src/services/attendance/heatmaps.section-stats.service.js";
import { getAtRiskStudents } from "./src/services/attendance/students.service.js";
import { getSectionSubjectHeatmap } from "./src/services/attendance/heatmaps.pattern.service.js";

async function main() {
  const year = await prisma.schoolYear.findFirst({ where: { isActive: true }, select: { id: true } });
  const term = await prisma.term.findFirst({
    where: { schoolYearId: year!.id, termNumber: 2 },
    select: { id: true, termNumber: true, startDate: true },
  });
  const displayTerm = { id: term!.id, termNumber: term!.termNumber, startDate: term!.startDate };
  const schoolYearId = year!.id;

  for (const [name, fn] of [
    ["section-stats", () => getSectionStats({ session: "AM" as const, schoolYearId, displayTerm, sharedOnly: true })],
    ["at-risk-students", () => getAtRiskStudents({ session: "AM" as const, schoolYearId, displayTerm, sharedOnly: true })],
    ["section-subject-heatmap", () => getSectionSubjectHeatmap({ schoolYearId, displayTerm, sharedOnly: true })],
  ] as const) {
    const t0 = Date.now();
    const data = await (fn as () => Promise<unknown>)();
    const ms = Date.now() - t0;
    const bytes = Buffer.byteLength(JSON.stringify(data));
    console.log(name, ms + "ms", (bytes / 1024).toFixed(1) + "KB");
  }
}

main().finally(() => prisma.$disconnect());
