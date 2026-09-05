"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Flag,
  CalendarClock,
  FilePenLine,
  Send,
  ClipboardList,
  BookPlus,
  Settings,
  ChevronDown,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import styles from "./teacher-sidebar.module.css";

type NavSubItem = {
  title: string;
  href: string;
  badge?: string;
};

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  subItems?: NavSubItem[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    label: "Main",
    items: [
      { title: "Overview", href: "/teacher/overview", icon: LayoutDashboard },
      { title: "My Classes", href: "/teacher/classes", icon: BookOpen },
      { title: "Grade Flags", href: "/teacher/grade-flags", icon: Flag },
      { title: "Attendance", href: "/teacher/attendance", icon: CalendarClock },
      { title: "Anecdotal", href: "/teacher/anecdotal", icon: FilePenLine },
    ],
  },
  {
    label: "Advisory",
    items: [
      { title: "Students", href: "/teacher/advisory/students", icon: CalendarClock },
      { title: "Referrals", href: "/teacher/advisory/referrals", icon: Send },
      { title: "ADM Cases", href: "/teacher/advisory/adm-cases", icon: ClipboardList },
      { title: "Modules (SF10)", href: "/teacher/modules/sf10", icon: BookPlus },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Settings", href: "/teacher/settings", icon: Settings },
    ],
  },
];

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) =>
      href === "/teacher/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function SidebarNav() {
  const isActive = useIsActive();
  const router = useRouter();

  const renderItem = (item: NavItem, nested = false) => {
    const active = isActive(item.href);
    const hasSub = !!item.subItems?.length;

    if (hasSub && !nested) {
      return (
        <li key={item.href}>
          <button
            type="button"
            className={`${styles.item} ${active ? styles.itemActive : ""}`}
            onClick={() => router.push(item.href)}
            aria-expanded={false}
          >
            <item.icon className={styles.itemIcon} />
            <span className={styles.itemLabel}>{item.title}</span>
            {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
            <ChevronDown className={styles.itemChevron} />
          </button>
        </li>
      );
    }

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`${styles.item} ${nested ? styles.subitem : ""} ${
            active ? styles.itemActive : ""
          }`}
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
      {NAV.flatMap((group) => group.items.map((item) => renderItem(item)))}
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

export function TeacherSidebar() {
  return <SidebarShell />;
}