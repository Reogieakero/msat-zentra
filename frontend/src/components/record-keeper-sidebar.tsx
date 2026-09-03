"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import styles from "./record-keeper-sidebar.module.css";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const NAV: NavItem[] = [
  { title: "Overview", href: "/record-keeper/overview", icon: LayoutDashboard },
];

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) =>
      href === "/record-keeper/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function SidebarNav() {
  const isActive = useIsActive();
  const router = useRouter();

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
    <ul className={styles.menu}>
      {NAV.map((item) => renderItem(item))}
    </ul>
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

export function RecordKeeperSidebar() {
  return <SidebarShell />;
}