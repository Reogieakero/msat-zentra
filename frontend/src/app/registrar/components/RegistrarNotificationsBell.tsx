"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  registrarNotificationTarget,
  registrarNotificationTitle,
} from "@/lib/notifications/label";

export function RegistrarNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["registrar-notifications"]}
      resolveTarget={registrarNotificationTarget}
      titleFor={registrarNotificationTitle}
    />
  );
}
