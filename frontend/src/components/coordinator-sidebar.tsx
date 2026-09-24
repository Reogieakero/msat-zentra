"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  ClipboardList,
  Award,
  Tablet,
} from "lucide-react";

import styles from "./coordinator-sidebar.module.css";

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

// ADM Coordinator nav — same top tab-bar pattern as the guidance/nurse
// desks. Five tabs only (see ADM_COORDINATOR_REPORT.md §5). Approval
// tracking lives as sub-tabs inside Certifications, not as its own nav
// item, to avoid the guidance duplicate-ADM-entry problem.
const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/coordinator/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Intake",
    items: [
      { title: "Referrals", href: "/coordinator/referrals", icon: Inbox },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { title: "Enrolled", href: "/coordinator/enrolled", icon: ClipboardList },
    ],
  },
  {
    label: "Records",
    items: [
      { title: "Certifications", href: "/coordinator/certifications", icon: Award },
      { title: "Devices", href: "/coordinator/devices", icon: Tablet },
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
      href === "/coordinator/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function CoordinatorNavbar() {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Coordinator sections">
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

export function CoordinatorSidebar() {
  return <CoordinatorNavbar />;
}
