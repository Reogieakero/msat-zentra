"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Award,
  UserCheck,
  ShieldQuestion,
  GraduationCap,
  FileBarChart,
  FileText,
} from "lucide-react";

import styles from "./registrar-sidebar.module.css";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

// Registrar nav — same GitHub-style top tab bar pattern as the nurse role.
// Groups only group the source data; every section is flattened into one
// row under the topbar.
const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/registrar/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Records",
    items: [
      { title: "Final Grades", href: "/registrar/final-grades", icon: Award },
      { title: "Account Approvals", href: "/registrar/accounts", icon: UserCheck },
      {
        title: "Adviser Access Requests",
        href: "/registrar/adviser-access",
        icon: ShieldQuestion,
      },
      {
        title: "Sections & Subjects",
        href: "/registrar/academics",
        icon: GraduationCap,
      },
      { title: "Report Cards", href: "/registrar/report-cards", icon: FileBarChart },
      { title: "SF10 Records", href: "/registrar/sf10", icon: FileText },
    ],
  },
];

// GitHub-style tab bar: every section flattened into one row under the
// topbar. Groups only group the source data, not the rendered tabs.
const TABS: NavItem[] = NAV.flatMap((group) => group.items);

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) =>
      href === "/registrar/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function RegistrarNavbar() {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Registrar sections">
      <ul className={styles.tabs}>
        {TABS.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className={styles.tabItem}>
              <Link
                href={item.href}
                className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className={styles.tabIcon} aria-hidden="true" />
                <span className={styles.tabLabel}>{item.title}</span>
                {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function RegistrarSidebar() {
  return <RegistrarNavbar />;
}
