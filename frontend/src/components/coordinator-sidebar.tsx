"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  GraduationCap,
  Award,
  Tablet,
  Settings,
  type LucideIcon,
} from "lucide-react";

import styles from "./coordinator-sidebar.module.css";
import BranchedMenu from "./nav/BranchedMenu";
import { CoordinatorSidebarReminder } from "./coordinator-sidebar-reminder";
import { CoordinatorSidebarDeviceReminder } from "./coordinator-sidebar-device-reminder";

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

// ADM Coordinator nav — branched left rail on desktop (same as the
// guidance/nurse/teacher desks), flattened tab bar on small screens.
// Five desk tabs (see ADM_COORDINATOR_REPORT.md §5) + General Settings.
// Approval tracking lives as sub-tabs inside Certifications, not as its own
// nav item, to avoid the guidance duplicate-ADM-entry problem.
//
// Shared-concept convention (same label + icon across desks):
// Overview=LayoutDashboard, ADM Cases=Inbox.
const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/coordinator/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Intake",
    items: [
      { title: "ADM Cases", href: "/coordinator/referrals", icon: Inbox },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { title: "Enrolled", href: "/coordinator/enrolled", icon: GraduationCap },
    ],
  },
  {
    label: "Records",
    items: [
      { title: "Certifications", href: "/coordinator/certifications", icon: Award },
      { title: "Devices", href: "/coordinator/devices", icon: Tablet },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "General Settings",
        href: "/coordinator/settings",
        icon: Settings,
      },
    ],
  },
];

// GitHub-style tab bar: every section flattened into one row on small
// screens. Groups only group the source data, not the rendered tabs.
const TABS: NavItem[] = NAV.flatMap((group) => group.items);

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) =>
      href === "/coordinator/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function CoordinatorNavbar({ tabs }: { tabs: NavItem[] }) {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Coordinator sections">
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

function CoordinatorRail({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = React.useCallback(
    (href: string) =>
      href === "/coordinator/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
  const tabs = groups.flatMap((group) => group.items);
  const activeHref = tabs.find((t) => isActive(t.href))?.href ?? "/coordinator/overview";
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

export function CoordinatorSidebar() {
  return (
    <>
      <aside className={`${styles.rail} ${styles.railDesktop}`} aria-label="Coordinator sections">
        <div className={styles.railScroll}>
          <CoordinatorRail groups={NAV} />
        </div>
        <div className={styles.reminderWrap}>
          <CoordinatorSidebarReminder />
          <CoordinatorSidebarDeviceReminder />
        </div>
      </aside>
      <div className={styles.tabsMobile}>
        <CoordinatorNavbar tabs={TABS} />
      </div>
    </>
  );
}
