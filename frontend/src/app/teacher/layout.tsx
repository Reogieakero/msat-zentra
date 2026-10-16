"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { logout } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/components/providers";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
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
import { Settings, Sun, Moon, UserRound, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ActiveTermBadge } from "@/components/term/ActiveTermBadge";
import { AdviserClaimGate } from "./components/AdviserClaimGate";
import {
  useTeacherProfileSettings,
} from "@/services/settings/profile-settings";
import { TeacherNotificationsBell } from "./components/TeacherNotificationsBell";
import { TeacherBamaPill } from "./components/TeacherBamaPill";
import { TemplateSaveProvider } from "./schedule/components/template-save-context";
import { AddAssessmentSaveProvider } from "./grading/[assignmentId]/components/add-assessment-save-context";
import { ScoreSaveProvider } from "./grading/[assignmentId]/components/score-save-context";
import { DeleteAssessmentSaveProvider } from "./grading/[assignmentId]/components/delete-assessment-save-context";
import { WeightsSaveProvider } from "./grading/[assignmentId]/components/weights-save-context";
import { BookingReminderStack } from "@/components/notifications/BookingReminderStack";
import { useTeacherRealtime } from "@/lib/realtime/teacherChannel";
import styles from "./record-teacher.module.css";

function TeacherShell({ children }: { children: React.ReactNode }) {
  useTeacherRealtime();

  return (
    <TemplateSaveProvider>
    <AddAssessmentSaveProvider>
    <ScoreSaveProvider>
    <DeleteAssessmentSaveProvider>
    <WeightsSaveProvider>
    <React.Suspense fallback={null}>
      <TeacherChrome>{children}</TeacherChrome>
    </React.Suspense>

      <AdviserClaimGate />
      <BookingReminderStack desk="teacher" />
    </WeightsSaveProvider>
    </DeleteAssessmentSaveProvider>
    </ScoreSaveProvider>
    </AddAssessmentSaveProvider>
    </TemplateSaveProvider>
  );
}

// Standalone mode (`?standalone=1`, used by the floating Bama bubble's new
// tab, and always for the schedule template new tab): no left sidebar
// links — just the page. The shell drops its rail offset and goes full width.
function TeacherChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = React.useState("");

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const standalone =
    searchParams.get("standalone") === "1" || pathname?.startsWith("/teacher/schedule/template") === true;

  const profile = useTeacherProfileSettings();

  const isDark = resolvedTheme === "dark";

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem("zentra.teacher.sidebar.collapsed") === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted rail state after mount
        setSidebarCollapsed(true);
      }
    } catch {
      /* private mode — stay expanded */
    }
  }, []);
  const handleSidebarToggle = React.useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          "zentra.teacher.sidebar.collapsed",
          next ? "1" : "0",
        );
      } catch {
        /* private mode — keep in-memory only */
      }
      return next;
    });
  }, []);

  const handleLogout = () => {

    void logout();
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("zentra."))
      .forEach((key) => window.localStorage.removeItem(key));

    queryClient.clear();
    router.push("/login");
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.topbar}>
        {standalone ? null : (
          <button
            type="button"
            onClick={handleSidebarToggle}
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={17} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={17} aria-hidden="true" />
            )}
          </button>
        )}
        <Link href="/teacher/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

        <div className={styles.spacer} />

        <TeacherBamaPill />

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
      {standalone ? null : (
        <TeacherSidebar collapsed={sidebarCollapsed} />
      )}
      <div
        className={
          standalone
            ? styles.shellStandalone
            : `${styles.shell} ${styles.shellWithRail} ${sidebarCollapsed ? styles.shellWithRailCollapsed : ""}`
        }
      >
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeacherShell>{children}</TeacherShell>;
}
