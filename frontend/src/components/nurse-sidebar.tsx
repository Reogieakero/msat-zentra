"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BellRing,
  Inbox,
  Stethoscope,
  HeartPulse,
  Flame,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";

import styles from "./nurse-sidebar.module.css";
import BranchedMenu from "./nav/BranchedMenu";
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

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/nurse/overview", icon: LayoutDashboard },
      { title: "Alerts", href: "/nurse/alerts", icon: BellRing },
    ],
  },
  {
    label: "Referrals",
    items: [
      {
        title: "ADM Cases",
        href: "/nurse/referrals/adm",
        icon: Inbox,
      },
      {
        title: "Clinic Matters",
        href: "/nurse/referrals/clinic",
        icon: Stethoscope,
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        title: "Health Records",
        href: "/nurse/health-records",
        icon: HeartPulse,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        title: "Referrals Report",
        href: "/nurse/adm",
        icon: Send,
      },
      {
        title: "Risk Dashboard",
        href: "/nurse/risk",
        icon: Flame,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "General Settings",
        href: "/nurse/settings",
        icon: Settings,
      },
    ],
  },
];

const TABS: NavItem[] = NAV.flatMap((group) => group.items);

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
                {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function NurseSidebar() {
  const railScrollRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <>
      <aside className={`${styles.rail} ${styles.railDesktop}`} aria-label="Nurse sections">
        <div ref={railScrollRef} className={styles.railScroll}>
          <NurseRail groups={NAV} />
        </div>
        <div className={styles.railHintWrap}>
          <ScrollDownHint
            scrollRef={railScrollRef}
            watchKey="nurse-nav"
            label="Scroll for more"
            className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
          />
        </div>
      </aside>
      <div className={styles.tabsMobile}>
        <NurseNavbar tabs={TABS} />
      </div>
    </>
  );
}
