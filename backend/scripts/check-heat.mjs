import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const session = "AM";
const activeTerm = await prisma.term.findFirst({
  where: { schoolYear: { isActive: true } },
  orderBy: { termNumber: "asc" },
  select: { id: true, startDate: true },
});
const termId = activeTerm?.id;
const where = { session, ...(termId ? { termId } : {}) };
const records = await prisma.attendanceRecord.findMany({
  where,
  include: { student: { select: { gradeLevel: true } } },
  orderBy: { date: "asc" },
});
const start = activeTerm?.startDate
  ? new Date(activeTerm.startDate.toISOString().slice(0, 10) + "T00:00:00Z")
  : null;
const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const axisStart = start ?? records[0]?.date ?? today;
const dayKeys = [];
for (let d = new Date(axisStart); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
  dayKeys.push(d.toISOString().slice(0, 10));
}
const gradeDayPresent = {};
for (const r of records) {
  const grade = r.student.gradeLevel;
  const key = r.date.toISOString().slice(0, 10);
  if (!gradeDayPresent[grade]) gradeDayPresent[grade] = new Map();
  if (!gradeDayPresent[grade].has(key)) gradeDayPresent[grade].set(key, 0);
  if (r.status === "present") gradeDayPresent[grade].set(key, gradeDayPresent[grade].get(key) + 1);
}
console.log("axis days:", dayKeys.length, "first", dayKeys[0], "last", dayKeys[dayKeys.length-1]);
console.log("G7 present sample:", JSON.stringify([...((gradeDayPresent["G7"] ?? new Map())).entries()].slice(0,3)));
let totalPresent = 0;
for (const m of Object.values(gradeDayPresent)) for (const v of m.values()) totalPresent += v;
console.log("TOTAL present across grades (AM):", totalPresent);
await prisma.$disconnect();
