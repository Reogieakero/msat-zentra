"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import styles from "./teacher-sidebar.module.css";
import BranchedMenu from "./nav/BranchedMenu";
import { NAV_ICONS } from "./nav/sidebar-icons";
import { SidebarIconRail } from "./nav/SidebarIconRail";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import {
  useCachedAdviser,
  useCachedMasterTeacher,
} from "@/services/teacher/flagCache";
import { useTeacherOverview } from "@/services/teacher/overview.service";
import { useSession } from "@/lib/auth/useSession";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export type { NavGroup, NavItem };

export function buildNav(isMasterTeacher: boolean, isAdviser: boolean): NavGroup[] {
  const workspaceItems = [
    { title: "Class", href: "/teacher/classes", icon: NAV_ICONS.class },
    { title: "Gradebook", href: "/teacher/grading", icon: NAV_ICONS.gradebook },
    { title: "Lock Grades", href: "/teacher/lock-grades", icon: NAV_ICONS.lockGrades },
    { title: "Attendance", href: "/teacher/attendance", icon: NAV_ICONS.attendance },
  ];
  if (isMasterTeacher) {
    workspaceItems.push({ title: "Timeslot", href: "/teacher/schedule", icon: NAV_ICONS.timeslot });
  }
  const groups: NavGroup[] = [
    { label: "Overview", items: [
      { title: "Dashboard", href: "/teacher/overview", icon: NAV_ICONS.overview },
      { title: "Student List", href: "/teacher/overview/students", icon: NAV_ICONS.studentList },
      { title: "Reports", href: "/teacher/overview/reports", icon: NAV_ICONS.reports },
    ] },
  ];
  if (isAdviser) {
    groups.push(
      { label: "Advisory", items: [
        { title: "Advisory List", href: "/teacher/advisory/list", icon: NAV_ICONS.advisoryList },
        { title: "Attendance", href: "/teacher/advisory/attendance", icon: NAV_ICONS.attendance },
        { title: "Academic", href: "/teacher/advisory/students", icon: NAV_ICONS.academic },
        { title: "Anecdotal", href: "/teacher/anecdotal", icon: NAV_ICONS.anecdotal },
        { title: "Referrals", href: "/teacher/advisory/referrals", icon: NAV_ICONS.referrals },
        { title: "Interventions", href: "/teacher/advisory/interventions", icon: NAV_ICONS.interventions },
        { title: "ADM", href: "/teacher/advisory/adm-cases", icon: NAV_ICONS.admCases },
        { title: "Modules", href: "/teacher/advisory/modules", icon: NAV_ICONS.modules },
        { title: "Class Schedule", href: "/teacher/advisory/schedule", icon: NAV_ICONS.schedule },
        { title: "SF10 Access", href: "/teacher/advisory/sf10-access", icon: NAV_ICONS.sf10Access },
      ]},
    );
  }
  groups.push(
    { label: "Workspace", items: workspaceItems },
    { label: "Settings", items: [{ title: "General Settings", href: "/teacher/settings", icon: NAV_ICONS.settings }] },
  );
  return groups;
}

export function TeacherSidebar({
  collapsed = true,
}: {
  collapsed?: boolean;
} = {}) {
  const session = useSession();
  const overview = useTeacherOverview();

  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher =
    overview.data?.isMasterTeacher ||
    overview.data?.isMasterTeacherSenior ||
    cachedMaster;
  const cachedAdviser = useCachedAdviser(session?.sub);
  const isAdviser = overview.data?.isAdviser ?? cachedAdviser ?? true;
  const nav = buildNav(isMasterTeacher, isAdviser);
  const tabs = nav.flatMap((group) => group.items);

  const railScrollRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <>
      <aside
        className={`${styles.rail} ${styles.railDesktop} ${collapsed ? styles.railCollapsed : ""}`}
        aria-label="Teacher sections"
      >
        {collapsed ? (
          <TeacherRailCollapsed groups={nav} />
        ) : (
          <>
            <div ref={railScrollRef} className={styles.railScroll}>
              <TeacherRail groups={nav} />
            </div>
            <div className={styles.railHintWrap}>
              <ScrollDownHint
                scrollRef={railScrollRef}
                watchKey={`${isAdviser}:${isMasterTeacher}`}
                label="Scroll for more"
                className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
              />
            </div>
          </>
        )}
      </aside>
      <div className={styles.tabsMobile}>
        <TeacherNavbar tabs={tabs} />
      </div>
    </>
  );
}

function TeacherRailCollapsed({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const activeHref =
    groups
      .flatMap((group) => group.items)
      .find((t) =>
        t.href === "/teacher/overview"
          ? pathname === t.href
          : pathname === t.href || pathname.startsWith(`${t.href}/`),
      )?.href ?? "/teacher/overview";
  return (
    <SidebarIconRail
      groups={groups}
      ariaLabel="Teacher sections, icon only"
      activeHref={activeHref}
    />
  );
}

function TeacherRail({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = React.useCallback(
    (href: string) =>
      href === "/teacher/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
  const tabs = groups.flatMap((group) => group.items);
  const activeHref = tabs.find((t) => isActive(t.href))?.href ?? "/teacher/overview";
  const defaultOpen = groups.map((_, i) => i);
  return (
    <BranchedMenu
      items={groups.map((group) => ({
        label: group.label,
        children: group.items.map((t) => ({
          value: t.href,
          label: t.title,
          href: t.href,
          icon: <t.icon size={16} strokeWidth={1.8} aria-hidden="true" />,
        })),
      }))}
      defaultOpen={defaultOpen.length > 0 ? defaultOpen : [0]}
      defaultActive={activeHref}
      activeValue={activeHref}
      onSelect={(_value, item) => {
        if ("href" in item && item.href) router.push(item.href);
      }}
      width={208}
    />
  );
}

function TeacherNavbar({ tabs }: { tabs: NavItem[] }) {
  const pathname = usePathname();
  const isActive = React.useCallback(
    (href: string) =>
      href === "/teacher/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );

  return (
    <nav className={styles.navbar} aria-label="Teacher sections">
      <ul className={styles.tabs}>
        {tabs.map((item) => {
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
