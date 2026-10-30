"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { RegistrarSidebar } from "@/components/registrar-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  RegistrarPaletteGate,
  useRegistrarProfileSettings,
} from "@/services/settings/profile-settings";
import {
  Command,
  CommandInput,
} from "@/components/ui/command";
import { UserRound } from "lucide-react";
import { KanbanAccountMenu } from "@/components/account/kanban-account-menu";
import { useCollapsibleSidebar } from "@/components/nav/use-collapsible-sidebar";
import { ActiveTermBadge } from "@/components/term/ActiveTermBadge";
import { AppBreadcrumbs } from "@/components/nav/AppBreadcrumbs";
import { RegistrarNotificationsBell } from "./components/RegistrarNotificationsBell";
import { useRegistrarRealtime } from "@/lib/realtime/registrarChannel";
import styles from "./registrar.module.css";

function RegistrarShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const profile = useRegistrarProfileSettings();
  const { collapsed: sidebarCollapsed } =
    useCollapsibleSidebar("zentra.registrar.sidebar.collapsed");

  useRegistrarRealtime();

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
      <RegistrarPaletteGate />
      <header className={styles.topbar}>
        <Link href="/registrar/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

        <AppBreadcrumbs role="Registrar" />

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

        <RegistrarNotificationsBell />

        <KanbanAccountMenu
          settingsHref="/registrar/settings"
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
      <RegistrarSidebar collapsed={sidebarCollapsed} />
      <div
        className={`${styles.shell} ${styles.shellWithRail} ${
          sidebarCollapsed ? styles.shellWithRailCollapsed : ""
        }`}
      >
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}

export default function RegistrarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RegistrarShell>{children}</RegistrarShell>;
}
