import { prisma } from "../../lib/prisma.js";
import { fanoutNotification } from "../../lib/notify.js";

export async function notifyMastersScheduleChanged(reason: string, excludeUserId?: string) {
  try {
    const masters = await prisma.user.findMany({
      where: { status: "active", staffProfile: { isMasterTeacher: true } },
      select: { id: true },
    });
    await Promise.all(
      masters
        .filter((m) => m.id !== excludeUserId)
        .map((m) =>
          fanoutNotification({
            userId: m.id,
            sourceTable: "section_timetable_entries",
            action: "schedule_update",
            message: reason,
          })
        )
    );
  } catch {

  }
}

export async function notifySectionTeachersScheduleChanged(
  sectionId: string | null,
  termId: string | null,
  reason: string,
  excludeUserId?: string,
) {
  try {
    if (!sectionId) return;
    const [assignments, timetableTeachers, sec] = await Promise.all([
      termId
        ? prisma.teacherSubjectAssignment.findMany({ where: { sectionId, termId }, select: { teacherId: true } })
        : prisma.teacherSubjectAssignment.findMany({ where: { sectionId }, select: { teacherId: true } }),
      termId
        ? prisma.sectionTimetableEntry.findMany({ where: { sectionId, termId }, select: { teacherName: { select: { userId: true } } } })
        : prisma.sectionTimetableEntry.findMany({ where: { sectionId }, select: { teacherName: { select: { userId: true } } } }),
      prisma.section.findUnique({ where: { id: sectionId }, select: { name: true, adviserId: true } }),
    ]);
    const ids = new Set<string>();
    for (const a of assignments) ids.add(a.teacherId);
    for (const t of timetableTeachers) {
      const uid = (t.teacherName as { userId?: string | null } | null)?.userId;
      if (uid) ids.add(uid);
    }
    if (sec?.adviserId) ids.add(sec.adviserId);
    if (excludeUserId) ids.delete(excludeUserId);
    const label = sec?.name ?? "your section";
    await Promise.all(
      [...ids].map((uid) =>
        fanoutNotification({
          userId: uid,
          sourceTable: "section_timetable_entries",
          action: "schedule_update",
          sourceId: sectionId,
          message: `${reason} (${label}).`,
        }),
      ),
    );
  } catch {

  }
}

export async function notifyMastersTeacherLinkChanged(
  teacherNameId: string,
  teacherName: string,
  code: string | null,
  action: "claim" | "unclaim"
) {
  try {
    const masters = await prisma.user.findMany({
      where: { status: "active", staffProfile: { isMasterTeacher: true } },
      select: { id: true },
    });
    const message =
      action === "claim"
        ? `${teacherName} linked code ${code ?? "—"} to their login — their classes now follow the scheduled timetable.`
        : `${teacherName} unlinked code ${code ?? "—"} from their login.`;
    await Promise.all(
      masters.map((m) =>
        fanoutNotification({
          userId: m.id,
          sourceTable: "teacher_names",
          action,
          sourceId: teacherNameId,
          message,
        })
      )
    );
  } catch {

  }
}
