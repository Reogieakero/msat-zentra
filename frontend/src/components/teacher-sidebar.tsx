"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  CalendarClock,
  Flag,
  ClipboardCheck,
  FilePenLine,
  Users,
  Send,
  Inbox,
  Cat,
} from "lucide-react";

import styles from "./teacher-sidebar.module.css";

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

// Teacher nav — same top tab-bar pattern as the nurse/guidance/coordinator
// desks. Every section flattened into one row under the topbar. Sub-routes
// (e.g. /teacher/anecdotal/folders) stay under their parent tab via prefix
// matching, so no submenu is needed.
//
// Shared-concept convention (same label + icon across desks):
// Overview=LayoutDashboard, Alerts=BellRing, ADM Cases=Inbox,
// ADM Referrals + My Referrals=Send, Anecdotal Records=FilePenLine,
// Risk Dashboard=Flame.
const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/teacher/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Classroom",
    items: [
      { title: "My Classes", href: "/teacher/classes", icon: BookOpen },
      { title: "Attendance", href: "/teacher/attendance", icon: CalendarClock },
    ],
  },
  {
    label: "Grading",
    items: [
      { title: "Gradebook", href: "/teacher/grading", icon: ClipboardCheck },
    ],
  },
  {
    label: "Advisory",
    items: [
      { title: "Students", href: "/teacher/advisory/students", icon: Users },
      { title: "My Referrals", href: "/teacher/advisory/referrals", icon: Send },
      { title: "ADM Cases", href: "/teacher/advisory/adm-cases", icon: Inbox },
    ],
  },
  {
    label: "Anecdotal",
    items: [
      {
        title: "Anecdotal Records",
        href: "/teacher/anecdotal",
        icon: FilePenLine,
      },
    ],
  },
  {
    label: "Flags",
    items: [
      { title: "Grade Flags", href: "/teacher/grade-flags", icon: Flag },
    ],
  },
  {
    label: "Assistant",
    items: [
      { title: "Chat with Bama", href: "/teacher/chat", icon: Cat },
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
      href === "/teacher/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function TeacherNavbar() {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Teacher sections">
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

export function TeacherSidebar() {
  return <TeacherNavbar />;
}
