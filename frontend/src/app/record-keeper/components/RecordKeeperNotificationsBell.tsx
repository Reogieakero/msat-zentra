"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  recordKeeperNotificationTarget,
  recordKeeperNotificationTitle,
} from "@/lib/notifications/label";

export function RecordKeeperNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["record-keeper-notifications"]}
      resolveTarget={recordKeeperNotificationTarget}
      titleFor={recordKeeperNotificationTitle}
    />
  );
}
