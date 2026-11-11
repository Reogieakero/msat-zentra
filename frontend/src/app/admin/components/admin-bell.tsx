"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";

/**
 * Admin accounts only receive system notifications; they have no desk queue to
 * deep-link into, so clicking a notice just marks it read.
 */
export function AdminBell() {
  return (
    <NotificationsBell
      queryKey={["admin-notifications"]}
      refreshKeys={[["admin-notifications"]]}
      resolveTarget={() => null}
    />
  );
}
