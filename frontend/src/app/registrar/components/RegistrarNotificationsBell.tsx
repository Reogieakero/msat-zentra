"use client";

import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import {
  registrarNotificationTarget,
  registrarNotificationTitle,
} from "@/lib/notifications/label";

/* Registrar inbox bell — the shared bell with registrar-scoped targets
   (pending sign-ups deep-link to the accounts queue, finals-ready to the
   finals list, access requests to the access queue, SF10 rows to SF10). */
export function RegistrarNotificationsBell() {
  return (
    <NotificationsBell
      queryKey={["registrar-notifications"]}
      resolveTarget={registrarNotificationTarget}
      titleFor={registrarNotificationTitle}
    />
  );
}
