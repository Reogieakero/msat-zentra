"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BellRing,
  Inbox,
  Stethoscope,
  Flame,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
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

// School Nurse nav — placeholder shell. Mirrors the Nurse scope: referred
// cases, clinic health records, and school-wide risk views. Pages render
// placeholders until the clinical workflows are built.
const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/nurse/overview", icon: LayoutDashboard },
      { title: "Alerts", href: "/nurse/alerts", icon: BellRing },
    ],
  },
  {
    label: "Cases",
    items: [
      {
        title: "Referrals to Me",
        href: "/nurse/referrals",
        icon: Inbox,
      },
      {
        title: "Health Records",
        href: "/nurse/health-records",
        icon: Stethoscope,
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

function SidebarNav() {
  const isActive = useIsActive();

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`${styles.item} ${active ? styles.itemActive : ""}`}
          aria-current={active ? "page" : undefined}
        >
          <item.icon className={styles.itemIcon} />
          <span className={styles.itemLabel}>{item.title}</span>
          {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
        </Link>
      </li>
    );
  };

  return (
    <>
      {NAV.map((group) => (
        <div key={group.label} className={styles.group}>
          <p className={styles.groupLabel}>{group.label}</p>
          <ul className={styles.menu}>
            {group.items.map((item) => renderItem(item))}
          </ul>
        </div>
      ))}
    </>
  );
}

function SidebarShell() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  const aside = (
    <aside className={styles.sidebar}>
      <nav className={styles.content}>
        <SidebarNav />
      </nav>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        <div
          className={`${styles.scrim} ${openMobile ? styles.scrimOpen : ""}`}
          onClick={() => setOpenMobile(false)}
        />
        <div className={`${styles.mobile} ${openMobile ? styles.mobileOpen : ""}`}>
          {aside}
        </div>
      </>
    );
  }

  return aside;
}

export function NurseSidebar() {
  return <SidebarShell />;
}
