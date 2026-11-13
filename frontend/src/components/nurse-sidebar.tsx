"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import styles from "./nurse-sidebar.module.css";
import BranchedMenu from "./nav/BranchedMenu";
import { NAV_ICONS } from "./nav/sidebar-icons";
import { SidebarIconRail } from "./nav/SidebarIconRail";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import {
  useNurseNavDots,
  useNurseNavDotInvalidation,
  type NurseNavDots,
} from "@/services/nurse/navCounts.service";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Red "new or updated since you last looked" dot. */
  dot?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/nurse/overview", icon: NAV_ICONS.overview },
      { title: "Alerts", href: "/nurse/alerts", icon: NAV_ICONS.alerts },
      { title: "Schedule", href: "/nurse/schedule", icon: NAV_ICONS.schedule },
    ],
  },
  {
    label: "Referrals",
    items: [
      {
        title: "ADM Cases",
        href: "/nurse/referrals/adm",
        icon: NAV_ICONS.admCases,
      },
      {
        title: "Clinic Matters",
        href: "/nurse/referrals/clinic",
        icon: NAV_ICONS.clinicMatters,
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        title: "Health Records",
        href: "/nurse/health-records",
        icon: NAV_ICONS.healthRecords,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        title: "Referrals Report",
        href: "/nurse/adm",
        icon: NAV_ICONS.referrals,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "General Settings",
        href: "/nurse/settings",
        icon: NAV_ICONS.settings,
      },
    ],
  },
];

/* Which live queue each nav entry watches. The dot comes from
   `/api/nurse/nav-counts`; a page with nothing unseen shows no dot. */
const QUEUE_FOR_HREF: Record<string, keyof NurseNavDots> = {
  "/nurse/overview": "overview",
  "/nurse/alerts": "alerts",
  "/nurse/referrals/adm": "adm",
  "/nurse/referrals/clinic": "clinic",
  "/nurse/health-records": "records",
  "/nurse/adm": "report",
};

function withDots(groups: NavGroup[], dots: NurseNavDots): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      dot: Boolean(QUEUE_FOR_HREF[item.href] && dots[QUEUE_FOR_HREF[item.href]]),
    })),
  }));
}

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

function NurseRail({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = React.useCallback(
    (href: string) =>
      href === "/nurse/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
  const tabs = groups.flatMap((group) => group.items);
  const activeHref = tabs.find((t) => isActive(t.href))?.href ?? "/nurse/overview";
  const defaultOpen = groups.map((_, i) => i);
  return (
    <BranchedMenu
      items={groups.map((group) => ({
        label: group.label,
        children: group.items.map((t) => ({
          value: t.href,
          label: t.title,
          href: t.href,
          dot: t.dot,
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

function NurseNavbar({ tabs }: { tabs: NavItem[] }) {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Nurse sections">
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
                {item.dot ? <span className={styles.dot} aria-hidden="true" /> : null}
                {item.dot ? <span className="sr-only">New activity</span> : null}
                {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function NurseSidebar({
  collapsed = true,
}: {
  collapsed?: boolean;
} = {}) {
  const railScrollRef = React.useRef<HTMLDivElement | null>(null);
  const isActive = useIsActive();
  const dots = useNurseNavDots();
  useNurseNavDotInvalidation(dots);
  const nav = React.useMemo(() => withDots(NAV, dots), [dots]);
  const tabs = React.useMemo(() => nav.flatMap((group) => group.items), [nav]);
  const activeHref = tabs.find((t) => isActive(t.href))?.href ?? "/nurse/overview";

  return (
    <>
      <aside
        className={`${styles.rail} ${styles.railDesktop} ${collapsed ? styles.railCollapsed : ""}`}
        aria-label="Nurse sections"
      >
        {collapsed ? (
          <SidebarIconRail
            groups={nav}
            ariaLabel="Nurse sections, icon only"
            activeHref={activeHref}
          />
        ) : (
          <>
            <div ref={railScrollRef} className={styles.railScroll}>
              <NurseRail groups={nav} />
            </div>
            <div className={styles.railHintWrap}>
              <ScrollDownHint
                scrollRef={railScrollRef}
                watchKey="nurse-nav"
                label="Scroll for more"
                className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
              />
            </div>
          </>
        )}
      </aside>
      <div className={styles.tabsMobile}>
        <NurseNavbar tabs={tabs} />
      </div>
    </>
  );
}
