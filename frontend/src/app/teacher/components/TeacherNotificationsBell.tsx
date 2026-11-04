"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  teacherNotificationTarget,
  teacherNotificationTitle,
} from "@/lib/notifications/label";

export function TeacherNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["teacher-notifications"]}
      refreshKeys={[
        ["teacher-notifications"],
        ["teacher-overview"],
        ["teacher-overview-secondary"],
        ["adm-my-cases"],
        ["adm-monitoring"],
        ["myReferrals"],
        ["advisory-students"],
        ["advisory-modules"],
        ["anecdotal-mine"],
        ["teacher-schedule"],
        ["grade-flags"],
      ]}
      resolveTarget={teacherNotificationTarget}
      titleFor={teacherNotificationTitle}
    />
  );
}
