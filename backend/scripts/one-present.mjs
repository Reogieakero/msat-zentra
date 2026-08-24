import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.attendanceRecord.findFirst({
  where: { status: "present", session: "AM" },
  include: { student: { include: { user: true } } },
  orderBy: { date: "asc" },
});
console.log(JSON.stringify({
  id: r.studentId,
  name: r.student.user.fullName,
  grade: r.student.gradeLevel,
  section: r.sectionId,
  session: r.session,
  date: r.date,
  termId: r.termId,
}));
await p.$disconnect();
