import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";

export type MasterTeacherBand = "7-10" | "11-12";

const BAND_GRADES: Record<MasterTeacherBand, readonly string[]> = {
  "7-10": ["G7", "G8", "G9", "G10"],
  "11-12": ["G11", "G12"],
};

export function gradeBandOf(gradeLevel: string): MasterTeacherBand | null {
  if (BAND_GRADES["7-10"].includes(gradeLevel)) return "7-10";
  if (BAND_GRADES["11-12"].includes(gradeLevel)) return "11-12";
  return null;
}

/** Bands the teacher currently holds a Master Teacher seat for. */
export async function masterTeacherBands(teacherId: string): Promise<MasterTeacherBand[]> {
  const profile = await prisma.staffProfile.findUnique({
    where: { userId: teacherId },
    select: { isMasterTeacher: true, isMasterTeacherSenior: true },
  });
  const bands: MasterTeacherBand[] = [];
  if (profile?.isMasterTeacher) bands.push("7-10");
  if (profile?.isMasterTeacherSenior) bands.push("11-12");
  return bands;
}

export async function requireMasterTeacher(
  teacherId: string,
  action: string,
  band?: MasterTeacherBand,
) {
  const bands = await masterTeacherBands(teacherId);
  const allowed = band ? bands.includes(band) : bands.length > 0;
  if (!allowed) {
    throw new AppError(403, "MASTER_TEACHER_REQUIRED", `Only Master Teachers can ${action}`);
  }
  return bands;
}

export async function resolveScheduleTarget(
  sectionId: string,
  subjectId: string | null,
  teacherId?: string,
) {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  const band = section ? gradeBandOf(section.gradeLevel as string) : null;
  if (!section || !band) {
    throw new AppError(
      403,
      "GRADE_BAND_NOT_ALLOWED",
      "Schedule subject is only available for grades 7–12"
    );
  }
  if (teacherId) {
    const bands = await masterTeacherBands(teacherId);
    if (!bands.includes(band)) {
      throw new AppError(
        403,
        "GRADE_BAND_NOT_ALLOWED",
        `This section belongs to the grades ${band === "11-12" ? "11–12" : "7–10"} Master Teacher scope`
      );
    }
  }
  if (subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) {
      throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found");
    }
    if (subject.gradeLevel !== section.gradeLevel) {
      throw new AppError(
        403,
        "GRADE_MISMATCH",
        "The subject must belong to the section's grade level"
      );
    }
  }
  return section;
}

export async function ensureSubjectAssignment(
  teacherId: string,
  subjectId: string,
  sectionId: string,
  termId: string
) {
  const existing = await prisma.teacherSubjectAssignment.findFirst({
    where: { teacherId, subjectId, sectionId, termId },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.teacherSubjectAssignment.create({
    data: { teacherId, subjectId, sectionId, termId },
    select: { id: true },
  });
}

export async function cleanupOrphanAssignment(
  teacherId: string,
  subjectId: string,
  sectionId: string,
  termId: string
) {
  const remaining = await prisma.sectionTimetableEntry.count({
    where: { sectionId, termId, subjectId },
  });
  if (remaining === 0) {
    await prisma.teacherSubjectAssignment.deleteMany({
      where: { teacherId, subjectId, sectionId, termId },
    });
  }
}

export async function findSubjectTeacherSplits(
  where: { sectionId?: string; termId: string },
): Promise<
  { subjectId: string; subjectName: string; sectionName: string; teacherNames: string[] }[]
> {
  const rows = await prisma.sectionTimetableEntry.findMany({
    where: { ...where, teacherNameId: { not: null } },
    select: {
      sectionId: true,
      subjectId: true,
      teacherNameId: true,
      subject: { select: { name: true } },
      section: { select: { name: true } },
      teacherName: { select: { name: true } },
    },
  });
  const bySubject = new Map<
    string,
    { subjectId: string; subjectName: string; sectionName: string; teachers: Map<string, string> }
  >();
  for (const r of rows) {
    if (!r.teacherNameId) continue;

    const key = `${r.sectionId}|${r.subjectId}`;
    let bucket = bySubject.get(key);
    if (!bucket) {
      bucket = {
        subjectId: r.subjectId,
        subjectName: r.subject?.name ?? "Subject",
        sectionName: r.section?.name ?? "section",
        teachers: new Map(),
      };
      bySubject.set(key, bucket);
    }
    bucket.teachers.set(r.teacherNameId, r.teacherName?.name ?? "another teacher");
  }
  return [...bySubject.values()]
    .filter((b) => b.teachers.size > 1)
    .map((b) => ({
      subjectId: b.subjectId,
      subjectName: b.subjectName,
      sectionName: b.sectionName,
      teacherNames: [...b.teachers.values()],
    }));
}
