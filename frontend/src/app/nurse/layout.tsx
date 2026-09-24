"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme, useFont } from "@/components/providers";
import { NurseSidebar } from "@/components/nurse-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Sun, Moon, UserRound, LogOut, Type } from "lucide-react";
import { NURSE_REFERRAL_DRAFT_KEY } from "./overview/components/nurse-overview-data";
import { useNurseRealtime } from "@/lib/realtime/nurseChannel";
import { useRoleGuard } from "@/lib/auth/useRoleGuard";
import { NurseNotificationsBell } from "./components/nurse-notifications-bell";
import styles from "./nurse.module.css";

function NurseShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { allowed } = useRoleGuard(["nurse"]);
  useNurseRealtime(allowed);
  const { resolvedTheme, setTheme } = useTheme();
  const { font, setFont } = useFont();

  const isDark = resolvedTheme === "dark";

  const handleLogout = () => {
    // Drop all cached queries so the next account on this device never sees
    // the previous nurse's student data (QueryClient outlives SPA logout).
    queryClient.clear();
    try {
      window.sessionStorage.removeItem(NURSE_REFERRAL_DRAFT_KEY);
    } catch {
      /* storage unavailable — nothing cached to clear */
    }
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("zentra."))
      .forEach((key) => window.localStorage.removeItem(key));
    router.push("/login");
  };

  // Block sensitive desk content until the role check passes. Backend stays
  // authoritative; this avoids flashing another role's cached data while the
  // redirect to /login or /errors/403 lands.
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

        <NurseNotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={styles.avatarButton}
              aria-label="Account menu"
            >
              <Avatar size="sm">
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
            <DropdownMenuItem className={styles.accountItem}>
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
            <div className={styles.accountGroup}>
              <div className={styles.accountGroupLabel}>
                <span>Font</span>
              </div>
              <DropdownMenuItem
                className={`${styles.accountItem} ${styles.accountSubItem}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setFont("inter");
                }}
              >
                <Type className={styles.accountIcon} />
                <span>Inter</span>
                {font === "inter" ? (
                  <span className={styles.accountCheck}>Active</span>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`${styles.accountItem} ${styles.accountSubItem}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setFont("nunito");
                }}
              >
                <Type className={styles.accountIcon} />
                <span>Nunito</span>
                {font === "nunito" ? (
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
      <NurseSidebar />
      <div className={styles.shell}>
        <main className={styles.main}>{children}</main>
      </div>
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
