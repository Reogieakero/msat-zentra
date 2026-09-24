"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Inbox,
  Stethoscope,
  HeartPulse,
  Flame,
  Send,
} from "lucide-react";

import styles from "./nurse-sidebar.module.css";

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

// School Nurse nav — Referrals are split into two dedicated pages (ADM
// Cases and Clinic Matters) so the reader never needs the old case-type
// filter; each page locks to its own type. ADM Referrals mirrors the
// guidance ADM Referrals page (reports + review queue) for nurse-scope
// ADM cases.
const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/nurse/overview", icon: LayoutDashboard },
      { title: "Referred Cases", href: "/nurse/alerts", icon: FolderOpen },
    ],
  },
  {
    label: "Referrals",
    items: [
      {
        title: "ADM Cases",
        href: "/nurse/referrals/adm",
        icon: Inbox,
      },
      {
        title: "Clinic Matters",
        href: "/nurse/referrals/clinic",
        icon: Stethoscope,
      },
      {
        title: "ADM Referrals",
        href: "/nurse/adm",
        icon: Send,
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        title: "Health Records",
        href: "/nurse/health-records",
        icon: HeartPulse,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        title: "Risk Dashboard",
        href: "/nurse/risk",
        icon: Flame,
      },
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
      href === "/nurse/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function NurseNavbar() {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Nurse sections">
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

export function NurseSidebar() {
  return <NurseNavbar />;
}
