"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { principalNotificationTarget } from "@/lib/notifications/label";

export function PrincipalBell() {
  return (
    <NotificationsBell
      queryKey={["principal-notifications"]}
      refreshKeys={[["principal-notifications"], ["principal-schedule-sections"]]}
      resolveTarget={principalNotificationTarget}
    />
  );
}
