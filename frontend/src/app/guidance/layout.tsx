"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/components/providers";
import { GuidanceSidebar } from "@/components/guidance-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandInput,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Sun, Moon, UserRound, LogOut } from "lucide-react";
import { ActiveTermBadge } from "@/components/term/ActiveTermBadge";
import { useGuidanceRealtime } from "@/lib/realtime/guidanceChannel";
import { GuidanceNotificationsBell } from "./components/GuidanceNotificationsBell";
import { BookingReminderStack } from "@/components/notifications/BookingReminderStack";
import { GuidancePaletteGate } from "./settings/components/profile-settings-data";
import { useRoleGuard } from "@/lib/auth/useRoleGuard";
import styles from "./guidance.module.css";

function GuidanceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { allowed } = useRoleGuard(["guidance_counselor"]);
  // Cross-user sync: another counselor's decision invalidates this desk's
  // lists without manual refresh. Single channel, cleaned up on unmount.
  // Only subscribe once the role check passes.
  useGuidanceRealtime(allowed);
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = React.useState("");

  const isDark = resolvedTheme === "dark";

  const handleLogout = () => {
    // Terminate the server refresh session (clears the httpOnly cookie) —
    // best-effort; the local wipe below runs regardless.
    void logout();
    // Drop all cached queries so the next account on this device never sees
    // the previous counselor's student data (QueryClient outlives SPA logout).
    queryClient.clear();
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("zentra."))
      .forEach((key) => window.localStorage.removeItem(key));
    router.push("/login");
  };

  // Block sensitive desk content until the role check passes (see nurse
  // shell — backend stays authoritative).
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
        <Link href="/guidance/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

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

        <GuidanceNotificationsBell />

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
            <DropdownMenuItem
              className={styles.accountItem}
              onSelect={(event) => {
                event.preventDefault();
                router.push("/guidance/settings");
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
      <GuidancePaletteGate />
      <GuidanceSidebar />
      <div className={`${styles.shell} ${styles.shellWithRail}`}>
        <main className={styles.main}>{children}</main>
      </div>
      <BookingReminderStack desk="guidance" />
    </div>
  );
}

export default function GuidanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GuidanceShell>{children}</GuidanceShell>;
}
