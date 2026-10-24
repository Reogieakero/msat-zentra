"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api/client";
import { PrincipalSidebar } from "@/components/principal-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { UserRound } from "lucide-react";
import { KanbanAccountMenu } from "@/components/account/kanban-account-menu";
import { SidebarToggleButton } from "@/components/nav/SidebarToggleButton";
import { useCollapsibleSidebar } from "@/components/nav/use-collapsible-sidebar";
import { ActiveTermBadge } from "@/components/term/ActiveTermBadge";
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

  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } =
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
        <SidebarToggleButton
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />

        <Link href="/principal/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

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
            <Avatar size="sm">
              {profile.data?.photoUrl ? (
                <AvatarImage src={profile.data.photoUrl} alt="Profile photo" />
              ) : null}
              <AvatarFallback>
                <UserRound className={styles.avatarIcon} />
              </AvatarFallback>
            </Avatar>
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
