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
        ["adm-my-cases"],
        ["myReferrals"],
        ["advisory-students"],
        ["anecdotal-mine"],
        ["teacher-schedule"],
        ["grade-flags"],
      ]}
      resolveTarget={teacherNotificationTarget}
      titleFor={teacherNotificationTitle}
    />
  );
}
