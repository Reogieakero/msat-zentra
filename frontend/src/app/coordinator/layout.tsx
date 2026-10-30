"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { CoordinatorSidebar } from "@/components/coordinator-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  Command,
  CommandInput,
} from "@/components/ui/command";
import { UserRound } from "lucide-react";
import { KanbanAccountMenu } from "@/components/account/kanban-account-menu";
import { useCollapsibleSidebar } from "@/components/nav/use-collapsible-sidebar";
import { useCoordinatorRealtime } from "@/lib/realtime/coordinatorChannel";
import { useRoleGuard } from "@/lib/auth/useRoleGuard";
import { CoordinatorNotificationsBell } from "./components/coordinator-notifications-bell";
import { BookingReminderStack } from "@/components/notifications/BookingReminderStack";
import { ActiveTermBadge } from "@/components/term/ActiveTermBadge";
import { AppBreadcrumbs } from "@/components/nav/AppBreadcrumbs";
import {
  CoordinatorPaletteGate,
  useCoordinatorProfileSettings,
} from "@/services/settings/profile-settings";
import styles from "./coordinator.module.css";

function CoordinatorShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { allowed } = useRoleGuard(["adm_coordinator"]);

  useCoordinatorRealtime(allowed);
  const [query, setQuery] = React.useState("");
  const profile = useCoordinatorProfileSettings();
  const { collapsed: sidebarCollapsed } =
    useCollapsibleSidebar("zentra.coordinator.sidebar.collapsed");

  const handleLogout = () => {

    void logout();

    queryClient.clear();
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("zentra."))
      .forEach((key) => window.localStorage.removeItem(key));
    router.push("/login");
  };

  if (!allowed) {
    return (
      <div className={styles.wrapper}>
        <section className={styles.main} aria-busy="true" aria-label="Checking access" role="status">
          <p>Checking access…</p>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.topbar}>
        <Link href="/coordinator/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

        <AppBreadcrumbs role="ADM Coordinator" />

        <div className={styles.spacer} />

        <ActiveTermBadge />

        <div className={styles.search}>
          <Command shouldFilter={false} className={styles.searchCommand}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search…"
            />
          </Command>
        </div>

        <CoordinatorNotificationsBell />

        <KanbanAccountMenu
          settingsHref="/coordinator/settings"
          onLogout={handleLogout}
        >
          <button
            type="button"
            className={styles.avatarButton}
            aria-label="Account menu"
          >
            {profile.data?.mascot ? (
              <span className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40">
                <StudentMascot
                  name={profile.data.fullName || "You"}
                  character={profile.data.mascot}
                  size={32}
                />
              </span>
            ) : (
              <Avatar size="sm">
                {profile.data?.photoUrl ? (
                  <AvatarImage src={profile.data.photoUrl} alt="Profile photo" />
                ) : null}
                <AvatarFallback>
                  <UserRound className={styles.avatarIcon} />
                </AvatarFallback>
              </Avatar>
            )}
          </button>
        </KanbanAccountMenu>
      </header>
      <CoordinatorSidebar collapsed={sidebarCollapsed} />
      <div
        className={`${styles.shell} ${styles.shellWithRail} ${
          sidebarCollapsed ? styles.shellWithRailCollapsed : ""
        }`}
      >
        <main className={styles.main}>{children}</main>
      </div>
      <CoordinatorPaletteGate />

      <BookingReminderStack desk="coordinator" />
    </div>
  );
}

export default function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CoordinatorShell>{children}</CoordinatorShell>;
}
