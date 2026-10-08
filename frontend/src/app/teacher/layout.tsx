"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/components/providers";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { AdviserClaimGate } from "./components/AdviserClaimGate";
import {
  TeacherPaletteGate,
  useTeacherProfileSettings,
} from "@/services/settings/profile-settings";
import { TeacherNotificationsBell } from "./components/TeacherNotificationsBell";
import { BookingReminderStack } from "@/components/notifications/BookingReminderStack";
import { useTeacherRealtime } from "@/lib/realtime/teacherChannel";
import styles from "./record-teacher.module.css";

const TopbarCrumbContext = React.createContext<{
  setCrumb: (node: React.ReactNode) => void;
}>({ setCrumb: () => {} });

export function useTopbarCrumb(crumb: React.ReactNode) {
  const { setCrumb } = React.useContext(TopbarCrumbContext);
  React.useEffect(() => {
    setCrumb(crumb);
    return () => setCrumb(null);
  }, [crumb, setCrumb]);
}

function TeacherShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = React.useState("");

  useTeacherRealtime();

  const profile = useTeacherProfileSettings();
  const [topbarCrumb, setTopbarCrumb] = React.useState<React.ReactNode>(null);
  const setCrumb = React.useCallback(
    (node: React.ReactNode) => setTopbarCrumb(node),
    [],
  );

  const isDark = resolvedTheme === "dark";

  const handleLogout = () => {

    void logout();
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("zentra."))
      .forEach((key) => window.localStorage.removeItem(key));

    queryClient.clear();
    router.push("/login");
  };

  return (
    <TopbarCrumbContext.Provider value={{ setCrumb }}>
    <TeacherPaletteGate />
    <div className={styles.wrapper}>
      <header className={styles.topbar}>
        <Link href="/teacher/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

        {topbarCrumb ? <div className={styles.crumb}>{topbarCrumb}</div> : null}

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

        <TeacherNotificationsBell />

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
          <DropdownMenuContent align="end" className={styles.accountMenu}>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={styles.accountItem}
              onSelect={(event) => {
                event.preventDefault();
                router.push("/teacher/settings");
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
      <TeacherSidebar />
      <div className={`${styles.shell} ${styles.shellWithRail}`}>
        <main className={styles.main}>{children}</main>
      </div>

      <AdviserClaimGate />
      <BookingReminderStack desk="teacher" />
    </div>
    </TopbarCrumbContext.Provider>
  );
}

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeacherShell>{children}</TeacherShell>;
}
