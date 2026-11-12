"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import styles from "./principal-sidebar.module.css";
import BranchedMenu from "./nav/BranchedMenu";
import { NAV_ICONS } from "./nav/sidebar-icons";
import { SidebarIconRail } from "./nav/SidebarIconRail";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";

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

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/principal/overview", icon: NAV_ICONS.overview },
    ],
  },
  {
    label: "Academics",
    items: [
      { title: "Academics", href: "/principal/academics", icon: NAV_ICONS.academics },
      {
        title: "Assigning",
        href: "/principal/academics/assign",
        icon: NAV_ICONS.assigning,
      },
      {
        title: "Schedule Approval",
        href: "/principal/academics/schedule",
        icon: NAV_ICONS.scheduleApproval,
      },
    ],
  },
  {
    label: "Risk",
    items: [
      { title: "Risk Board", href: "/principal/risk", icon: NAV_ICONS.riskBoard },
      { title: "Students", href: "/principal/risk/students", icon: NAV_ICONS.students },
      {
        title: "Attendance Heatmap",
        href: "/principal/risk/heatmaps/attendance",
        icon: NAV_ICONS.attendance,
      },
      {
        title: "Academic Heatmap",
        href: "/principal/risk/heatmaps/academics",
        icon: NAV_ICONS.academicHeatmap,
      },
      {
        title: "Behavioral Records",
        href: "/principal/risk/heatmaps/records",
        icon: NAV_ICONS.behavioralRecords,
      },
      {
        title: "Interventions",
        href: "/principal/risk/interventions",
        icon: NAV_ICONS.interventions,
      },
    ],
  },
  {
    label: "ADM Cases",
    items: [
      {
        title: "Referrals",
        href: "/principal/adm/referrals/all",
        icon: NAV_ICONS.referrals,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "ADM Report", href: "/principal/adm", icon: NAV_ICONS.admReport },
      { title: "Honor Roll", href: "/principal/honor-roll", icon: NAV_ICONS.honorRoll },
      { title: "Audit Log", href: "/principal/audit", icon: NAV_ICONS.auditLog },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "General Settings",
        href: "/principal/settings",
        icon: NAV_ICONS.settings,
      },
    ],
  },
];

const TABS: NavItem[] = NAV.flatMap((group) => group.items);

function matches(href: string, pathname: string, exactRoot: string) {
  if (href === exactRoot) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveHref(tabs: NavItem[], pathname: string) {
  let best: string | null = null;
  for (const t of tabs) {
    if (!matches(t.href, pathname, "/principal/overview")) continue;
    if (best === null || t.href.length > best.length) best = t.href;
  }
  return best ?? "/principal/overview";
}

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) => matches(href, pathname, "/principal/overview"),
    [pathname],
  );
}

function PrincipalNavbar({ tabs }: { tabs: NavItem[] }) {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Principal sections">
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

function PrincipalRail({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = groups.flatMap((group) => group.items);
  const activeHref = findActiveHref(tabs, pathname);
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

export function PrincipalSidebar({
  collapsed = true,
}: {
  collapsed?: boolean;
} = {}) {
  const pathname = usePathname();
  const railScrollRef = React.useRef<HTMLDivElement | null>(null);
  const activeHref = findActiveHref(TABS, pathname);

  return (
    <>
      <aside
        className={`${styles.rail} ${styles.railDesktop} ${collapsed ? styles.railCollapsed : ""}`}
        aria-label="Principal sections"
      >
        {collapsed ? (
          <SidebarIconRail
            groups={NAV}
            ariaLabel="Principal sections, icon only"
            activeHref={activeHref}
          />
        ) : (
          <>
            <div ref={railScrollRef} className={styles.railScroll}>
              <PrincipalRail groups={NAV} />
            </div>
            <div className={styles.railHintWrap}>
              <ScrollDownHint
                scrollRef={railScrollRef}
                watchKey="principal-nav"
                label="Scroll for more"
                className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
              />
            </div>
          </>
        )}
      </aside>
      <div className={styles.tabsMobile}>
        <PrincipalNavbar tabs={TABS} />
      </div>
    </>
  );
}
