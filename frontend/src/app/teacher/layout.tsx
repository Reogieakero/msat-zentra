"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { logout } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  Command,
  CommandInput,
} from "@/components/ui/command";
import { UserRound } from "lucide-react";
import { KanbanAccountMenu } from "@/components/account/kanban-account-menu";
import { useCollapsibleSidebar } from "@/components/nav/use-collapsible-sidebar";
import { ActiveTermBadge } from "@/components/term/ActiveTermBadge";
import { AppBreadcrumbs } from "@/components/nav/AppBreadcrumbs";
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
  const [query, setQuery] = React.useState("");

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const standalone =
    searchParams.get("standalone") === "1" || pathname?.startsWith("/teacher/schedule/template") === true;

  const profile = useTeacherProfileSettings();

  const { collapsed: sidebarCollapsed } =
    useCollapsibleSidebar("zentra.teacher.sidebar.collapsed");

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
        <Link href="/teacher/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

        <AppBreadcrumbs role="Teacher" />

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

        <KanbanAccountMenu
          settingsHref="/teacher/settings"
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
