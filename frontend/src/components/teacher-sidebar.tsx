"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FilePenLine,
  FileText,
  GraduationCap,
  Send,
  Inbox,
  Cat,
  Settings,
  Users,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import styles from "./teacher-sidebar.module.css";
import BranchedMenu from "./nav/BranchedMenu";
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

function buildNav(isMasterTeacher: boolean, isAdviser: boolean): NavGroup[] {
  const workspaceItems = [
    { title: "Class", href: "/teacher/classes", icon: BookOpen },
    { title: "Gradebook", href: "/teacher/grading", icon: ClipboardCheck },
    { title: "Attendance", href: "/teacher/attendance", icon: CalendarClock },
  ];
  if (isAdviser) {
    workspaceItems.push({ title: "Chat with Bama", href: "/teacher/chat", icon: Cat });
  }
  if (isMasterTeacher) {
    workspaceItems.push({ title: "Timeslot", href: "/teacher/schedule", icon: ListChecks });
  }
  const groups: NavGroup[] = [
    { label: "Overview", items: [
      { title: "Dashboard", href: "/teacher/overview", icon: LayoutDashboard },
      { title: "Student List", href: "/teacher/overview/students", icon: Users },
      { title: "Reports", href: "/teacher/overview/reports", icon: FileText },
    ] },
  ];
  if (isAdviser) {
    groups.push(
      { label: "Advisory", items: [
        { title: "Advisory List", href: "/teacher/advisory/list", icon: Users },
        { title: "Attendance", href: "/teacher/advisory/attendance", icon: CalendarClock },
        { title: "Academic", href: "/teacher/advisory/students", icon: GraduationCap },
        { title: "Anecdotal", href: "/teacher/anecdotal", icon: FilePenLine },
        { title: "Referrals", href: "/teacher/advisory/referrals", icon: Send },
        { title: "ADM", href: "/teacher/advisory/adm-cases", icon: Inbox },
        { title: "Class Schedule", href: "/teacher/advisory/schedule", icon: CalendarDays },
      ]},
    );
  }
  groups.push(
    { label: "Workspace", items: workspaceItems },
    { label: "Settings", items: [{ title: "General Settings", href: "/teacher/settings", icon: Settings }] },
  );
  return groups;
}

export function TeacherSidebar() {
  const session = useSession();
  const overview = useTeacherOverview();

  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher = overview.data?.isMasterTeacher ?? cachedMaster;
  const cachedAdviser = useCachedAdviser(session?.sub);
  const isAdviser = overview.data?.isAdviser ?? cachedAdviser ?? true;
  const nav = buildNav(isMasterTeacher, isAdviser);
  const tabs = nav.flatMap((group) => group.items);

  const railScrollRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <>
      <aside className={`${styles.rail} ${styles.railDesktop}`} aria-label="Teacher sections">
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
      </aside>
      <div className={styles.tabsMobile}>
        <TeacherNavbar tabs={tabs} />
      </div>
    </>
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
