"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { teacherNotificationTarget } from "@/lib/notifications/label";

/* Teacher inbox bell — the shared bell with teacher-scoped targets
   (schedule verdicts deep-link to the section's timetable). */
export function TeacherNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["teacher-notifications"]}
      refreshKeys={[["teacher-notifications"], ["teacher-schedule"]]}
      resolveTarget={teacherNotificationTarget}
    />
  );
}
