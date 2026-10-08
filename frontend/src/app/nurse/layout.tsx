"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/components/providers";
import { NurseSidebar } from "@/components/nurse-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Sun, Moon, UserRound, LogOut } from "lucide-react";
import { NURSE_REFERRAL_DRAFT_KEY } from "@/services/nurse/referrals.service";
import { useNurseRealtime } from "@/lib/realtime/nurseChannel";
import { useRoleGuard } from "@/lib/auth/useRoleGuard";
import { ActiveTermBadge } from "@/components/term/ActiveTermBadge";
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
  const { resolvedTheme, setTheme } = useTheme();
  const profile = useNurseProfileSettings();

  const isDark = resolvedTheme === "dark";

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

        <div className={styles.spacer} />

        <ActiveTermBadge />

        <NurseNotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={styles.avatarButton}
              aria-label="Account menu"
            >
              <Avatar size="sm">
                {profile.data?.photoUrl ? (
                  <AvatarImage src={profile.data.photoUrl} alt="Profile photo" />
                ) : null}
                <AvatarFallback>
                  <UserRound className={styles.avatarIcon} />
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={styles.accountMenu}
          >
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={styles.accountItem}
              onSelect={(event) => {
                event.preventDefault();
                router.push("/nurse/settings");
              }}
            >
              <Settings className={styles.accountIcon} />
              <span>Settings</span>
            </DropdownMenuItem>
            <div className={styles.accountGroup}>
              <div className={styles.accountGroupLabel}>
                <span>System Preference</span>
              </div>
              <DropdownMenuItem
                className={`${styles.accountItem} ${styles.accountSubItem}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setTheme("light");
                }}
              >
                <Sun className={styles.accountIcon} />
                <span>Light</span>
                {!isDark ? (
                  <span className={styles.accountCheck}>Active</span>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`${styles.accountItem} ${styles.accountSubItem}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setTheme("dark");
                }}
              >
                <Moon className={styles.accountIcon} />
                <span>Dark</span>
                {isDark ? (
                  <span className={styles.accountCheck}>Active</span>
                ) : null}
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={styles.accountItem}
              onSelect={(event) => {
                event.preventDefault();
                handleLogout();
              }}
            >
              <LogOut className={styles.accountIcon} />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <NursePaletteGate />
      <NurseSidebar />
      <div className={`${styles.shell} ${styles.shellWithRail}`}>
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
