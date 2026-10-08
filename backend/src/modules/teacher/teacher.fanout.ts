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
