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
  ClipboardList,
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
      { title: "Grade Flags", href: "/teacher/grade-flags", icon: Flag },
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
      { title: "Referrals", href: "/teacher/advisory/referrals", icon: Send },
      { title: "ADM Cases", href: "/teacher/advisory/adm-cases", icon: ClipboardList },
    ],
  },
  {
    label: "Anecdotal",
    items: [
      {
        title: "Records",
        href: "/teacher/anecdotal",
        icon: FilePenLine,
        subItems: [
          { title: "Folders", href: "/teacher/anecdotal/folders" },
        ],
      },
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
  const pathname = usePathname();
  // Manual expand/collapse overrides. Otherwise a parent auto-opens whenever
  // the route sits on one of its sublinks.
  const [manual, setManual] = React.useState<Record<string, boolean>>({});

  const isSubActive = (sub: NavSubItem) =>
    pathname === sub.href || pathname.startsWith(`${sub.href}/`);

  const isExpanded = (item: NavItem) => {
    if (manual[item.href] !== undefined) return manual[item.href];
    return item.subItems?.some(isSubActive) ?? false;
  };

  const toggle = (item: NavItem) => {
    const next = !isExpanded(item);
    setManual((prev) => ({ ...prev, [item.href]: next }));
  };

  const renderSubItem = (sub: NavSubItem) => {
    const active = isActive(sub.href);
    return (
      <li key={sub.href}>
        <Link
          href={sub.href}
          className={`${styles.item} ${styles.subitem} ${active ? styles.itemActive : ""}`}
          aria-current={active ? "page" : undefined}
        >
          <span className={styles.itemLabel}>{sub.title}</span>
          {sub.badge ? <span className={styles.badge}>{sub.badge}</span> : null}
        </Link>
      </li>
    );
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const hasSub = !!item.subItems?.length;
    const expanded = isExpanded(item);

    if (hasSub) {
      return (
        <li key={item.href}>
          <div className={`${styles.item} ${active ? styles.itemActive : ""}`}>
            <Link
              href={item.href}
              className={styles.parentLink}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className={styles.itemIcon} />
              <span className={styles.itemLabel}>{item.title}</span>
            </Link>
            {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
            <button
              type="button"
              className={styles.chevronButton}
              onClick={() => toggle(item)}
              aria-expanded={expanded}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${item.title} submenu`}
            >
              <ChevronDown
                className={`${styles.itemChevron} ${expanded ? styles.itemChevronOpen : ""}`}
              />
            </button>
          </div>
          {expanded ? (
            <ul className={styles.submenu}>
              {item.subItems!.map((sub) => renderSubItem(sub))}
            </ul>
          ) : null}
        </li>
      );
    }

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

export function TeacherSidebar() {
  return <SidebarShell />;
}
