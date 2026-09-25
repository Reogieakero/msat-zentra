"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BellRing,
  Inbox,
  MessagesSquare,
  FilePenLine,
  ClipboardList,
  Send,
  Flame,
} from "lucide-react";

import styles from "./guidance-sidebar.module.css";

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

// Guidance Counselor nav — same top tab-bar pattern as the nurse desk.
// Referrals are split into two dedicated pages (ADM Cases and Counseling
// Cases) so the reader never needs the track filter; each page locks to
// its own track. Sub-routes (risk heatmap / behavioral) stay under the
// Risk Dashboard tab via prefix matching, so no submenu is needed.
//
// Shared-concept convention (same label + icon across desks):
// Overview=LayoutDashboard, Alerts=BellRing, ADM Cases=Inbox,
// ADM Referrals=Send, Anecdotal Records=FilePenLine,
// Risk Dashboard=Flame.
const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/guidance/overview", icon: LayoutDashboard },
      { title: "Alerts", href: "/guidance/alerts", icon: BellRing },
    ],
  },
  {
    label: "Referrals",
    items: [
      {
        title: "ADM Cases",
        href: "/guidance/referrals/adm",
        icon: Inbox,
      },
      {
        title: "Counseling Cases",
        href: "/guidance/referrals/counseling",
        icon: MessagesSquare,
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        title: "Anecdotal Records",
        href: "/guidance/anecdotal",
        icon: FilePenLine,
      },
    ],
  },
  {
    label: "Intervention",
    items: [
      {
        title: "Interventions",
        href: "/guidance/interventions",
        icon: ClipboardList,
      },
      { title: "ADM Referrals", href: "/guidance/adm", icon: Send },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        title: "Risk Dashboard",
        href: "/guidance/risk",
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
      href === "/guidance/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function GuidanceNavbar() {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Guidance sections">
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

export function GuidanceSidebar() {
  return <GuidanceNavbar />;
}
