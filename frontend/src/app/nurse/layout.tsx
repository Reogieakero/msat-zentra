"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { NurseSidebar } from "@/components/nurse-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { UserRound } from "lucide-react";
import { KanbanAccountMenu } from "@/components/account/kanban-account-menu";
import { useCollapsibleSidebar } from "@/components/nav/use-collapsible-sidebar";
import { NURSE_REFERRAL_DRAFT_KEY } from "@/services/nurse/referrals.service";
import { useNurseRealtime } from "@/lib/realtime/nurseChannel";
import { useRoleGuard } from "@/lib/auth/useRoleGuard";
import { ActiveTermBadge } from "@/components/term/ActiveTermBadge";
import { AppBreadcrumbs } from "@/components/nav/AppBreadcrumbs";
import { NurseNotificationsBell } from "./components/nurse-notifications-bell";
import { BookingReminderStack } from "@/components/notifications/BookingReminderStack";
import {
  NursePaletteGate,
  useNurseProfileSettings,
} from "@/services/settings/profile-settings";
import styles from "./nurse.module.css";

function NurseShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { allowed } = useRoleGuard(["nurse"]);
  useNurseRealtime(allowed);
  const profile = useNurseProfileSettings();
  const { collapsed: sidebarCollapsed } =
    useCollapsibleSidebar("zentra.nurse.sidebar.collapsed");

  const handleLogout = () => {

    void logout();

    queryClient.clear();
    try {
      window.sessionStorage.removeItem(NURSE_REFERRAL_DRAFT_KEY);
    } catch {

    }
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
        <Link href="/nurse/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

        <AppBreadcrumbs role="School Nurse" />

        <div className={styles.spacer} />

        <ActiveTermBadge />

        <NurseNotificationsBell />

        <KanbanAccountMenu
          settingsHref="/nurse/settings"
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
      <NursePaletteGate />
      <NurseSidebar collapsed={sidebarCollapsed} />
      <div
        className={`${styles.shell} ${styles.shellWithRail} ${
          sidebarCollapsed ? styles.shellWithRailCollapsed : ""
        }`}
      >
        <main className={styles.main}>{children}</main>
      </div>
      <BookingReminderStack desk="nurse" />
    </div>
  );
}

export default function NurseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NurseShell>{children}</NurseShell>;
}
