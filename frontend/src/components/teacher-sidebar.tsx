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
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import styles from "./teacher-sidebar.module.css";
import BranchedMenu from "./nav/BranchedMenu";
import CardNav, { type CardNavItem } from "./nav/CardNav";
import { useLinksLayout } from "@/lib/links-layout";
import {
  useCachedMasterTeacher,
  useTeacherOverview,
} from "@/app/teacher/overview/components/teacher-overview-data";
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

// Teacher nav branching: Overview (dashboard), Advisory (attendance,
// academic, anecdotal, adm), Workspace (class, gradebook, attendance,
// referrals, chat, + timeslot for masters), Settings (general settings).
// Sub-routes (e.g. /teacher/schedule/[sectionId]) stay under their parent
// via prefix matching.
function buildNav(isMasterTeacher: boolean): NavGroup[] {
  const workspaceItems = [
    { title: "Class", href: "/teacher/classes", icon: BookOpen },
    { title: "Gradebook", href: "/teacher/grading", icon: ClipboardCheck },
    { title: "Attendance", href: "/teacher/attendance", icon: CalendarClock },
    { title: "Referrals", href: "/teacher/advisory/referrals", icon: Send },
    { title: "Chat with Bama", href: "/teacher/chat", icon: Cat },
  ];
  if (isMasterTeacher) {
    workspaceItems.push({ title: "Timeslot", href: "/teacher/schedule", icon: ListChecks });
  }
  return [
    { label: "Overview", items: [
      { title: "Dashboard", href: "/teacher/overview", icon: LayoutDashboard },
      { title: "Reports", href: "/teacher/overview/reports", icon: FileText },
    ] },
    { label: "Advisory", items: [
      { title: "Attendance", href: "/teacher/advisory/attendance", icon: CalendarClock },
      { title: "Academic", href: "/teacher/advisory/students", icon: GraduationCap },
      { title: "Anecdotal", href: "/teacher/anecdotal", icon: FilePenLine },
      { title: "ADM", href: "/teacher/advisory/adm-cases", icon: Inbox },
      { title: "Class Schedule", href: "/teacher/advisory/schedule", icon: CalendarDays },
    ]},
    { label: "Workspace", items: workspaceItems },
    { label: "Settings", items: [{ title: "General Settings", href: "/teacher/settings", icon: Settings }] },
  ];
}

export function TeacherSidebar() {
  const session = useSession();
  const overview = useTeacherOverview();
  // First-frame value from the per-teacher cache: the Schedule tab must not
  // pop in after a hard refresh. The live overview overwrites it on resolve.
  const cachedMaster = useCachedMasterTeacher(session?.sub);
  const isMasterTeacher = overview.data?.isMasterTeacher ?? cachedMaster;
  const [linksLayout] = useLinksLayout();
  const nav = buildNav(isMasterTeacher);
  const tabs = nav.flatMap((group) => group.items);

  // Navbar mode is the CardNav top bar. Sidebar mode swaps it for a left
  // branched rail on desktop; the tab bar still serves small screens.
  if (linksLayout !== "sidebar") {
    return <TeacherCardNav nav={nav} />;
  }
  return (
    <>
      <aside className={`${styles.rail} ${styles.railDesktop}`} aria-label="Teacher sections">
        <TeacherRail groups={nav} />
      </aside>
      <div className={styles.tabsMobile}>
        <TeacherNavbar tabs={tabs} />
      </div>
    </>
  );
}

function TeacherCardNav({ nav }: { nav: NavGroup[] }) {
  const pick = (label: string) => nav.find((g) => g.label === label)?.items ?? [];
  const tint = (pct: number) => `color-mix(in oklch, var(--primary) ${pct}%, var(--card))`;
  const cards: CardNavItem[] = [
    {
      label: "Overview",
      bgColor: "var(--primary)",
      textColor: "var(--primary-foreground)",
      links: pick("Overview").map((t) => ({ label: t.title, ariaLabel: t.title, href: t.href })),
    },
    {
      label: "Advisory",
      bgColor: tint(14),
      textColor: "var(--foreground)",
      links: pick("Advisory").map((t) => ({ label: t.title, ariaLabel: t.title, href: t.href })),
    },
    {
      label: "Workspace",
      bgColor: tint(7),
      textColor: "var(--foreground)",
      links: pick("Workspace").map((t) => ({ label: t.title, ariaLabel: t.title, href: t.href })),
    },
    {
      label: "Settings",
      bgColor: tint(4),
      textColor: "var(--foreground)",
      links: pick("Settings").map((t) => ({ label: t.title, ariaLabel: t.title, href: t.href })),
    },
  ];
  return (
    <div className={styles.cardNavWrap}>
      <CardNav brand="Zentra" items={cards} ease="power3.out" />
    </div>
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
      accentColor="#f59e0b"
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
