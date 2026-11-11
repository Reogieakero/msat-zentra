"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { logout } from "@/lib/api/client";
import { AdminSidebar } from "@/components/admin-sidebar";
import { KanbanAccountMenu } from "@/components/account/kanban-account-menu";
import { useCollapsibleSidebar } from "@/components/nav/use-collapsible-sidebar";
import { AppBreadcrumbs } from "@/components/nav/AppBreadcrumbs";
import { useRoleGuard } from "@/lib/auth/useRoleGuard";
import { AdminBell } from "./components/admin-bell";
import styles from "./admin.module.css";

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { allowed } = useRoleGuard(["admin"]);
  const { collapsed: sidebarCollapsed } = useCollapsibleSidebar(
    "zentra.admin.sidebar.collapsed",
  );

  const handleLogout = () => {
    void logout();
    queryClient.clear();
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("zentra."))
      .forEach((key) => window.localStorage.removeItem(key));
    router.push("/login/admin");
  };

  if (!allowed) {
    return (
      <div className={styles.wrapper}>
        <section
          className={styles.main}
          aria-busy="true"
          aria-label="Checking access"
          role="status"
        >
          <p>Checking access…</p>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.topbar}>
        <Link href="/admin/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

        <AppBreadcrumbs role="Administrator" />

        <div className={styles.spacer} />

        <AdminBell />

        <KanbanAccountMenu
          settingsHref="/admin/settings"
          onLogout={handleLogout}
        >
          <button
            type="button"
            className={styles.avatarButton}
            aria-label="Account menu"
          >
            <ShieldCheck className={styles.avatarIcon} aria-hidden="true" />
          </button>
        </KanbanAccountMenu>
      </header>

      <AdminSidebar collapsed={sidebarCollapsed} />

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
