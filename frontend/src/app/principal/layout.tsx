"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/client";
import { PrincipalSidebar } from "@/components/principal-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import { UserRound } from "lucide-react";
import { KanbanAccountMenu } from "@/components/account/kanban-account-menu";
import { useCollapsibleSidebar } from "@/components/nav/use-collapsible-sidebar";
import { ActiveTermBadge } from "@/components/term/ActiveTermBadge";
import { AppBreadcrumbs } from "@/components/nav/AppBreadcrumbs";
import { PrincipalBell } from "./components/PrincipalBell";
import { usePrincipalRealtime } from "@/lib/realtime/principalChannel";
import {
  PrincipalPaletteGate,
  usePrincipalProfileSettings,
} from "@/services/settings/profile-settings";
import styles from "./principal.module.css";

function PrincipalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const { collapsed: sidebarCollapsed } =
    useCollapsibleSidebar("zentra.principal.sidebar.collapsed");

  usePrincipalRealtime();
  const profile = usePrincipalProfileSettings();

  const handleLogout = () => {

    void logout();
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("zentra."))
      .forEach((key) => window.localStorage.removeItem(key));
    router.push("/login");
  };

  return (
    <div className={styles.wrapper}>
      <PrincipalPaletteGate />
      <header className={styles.topbar}>
        <Link href="/principal/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

        <AppBreadcrumbs role="Principal" />

        <div className={styles.spacer} />

        <ActiveTermBadge />

        <div className={styles.search}>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search"
            className={styles.searchCommand}
          />
        </div>

        <PrincipalBell />

        <KanbanAccountMenu
          settingsHref="/principal/settings"
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
      <PrincipalSidebar collapsed={sidebarCollapsed} />
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

export default function PrincipalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PrincipalShell>{children}</PrincipalShell>;
}
