"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Award,
  UserCheck,
  ShieldQuestion,
  FileBarChart,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

import styles from "./registrar-sidebar.module.css";
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
      { title: "Overview", href: "/registrar/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Records",
    items: [
      { title: "Final Grades", href: "/registrar/final-grades", icon: Award },
      { title: "Account Approvals", href: "/registrar/accounts", icon: UserCheck },
      {
        title: "Adviser Access Requests",
        href: "/registrar/adviser-access",
        icon: ShieldQuestion,
      },
      { title: "Report Cards", href: "/registrar/report-cards", icon: FileBarChart },
      { title: "SF10 Records", href: "/registrar/sf10", icon: FileText },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "General Settings",
        href: "/registrar/settings",
        icon: Settings,
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
    if (!matches(t.href, pathname, "/registrar/overview")) continue;
    if (best === null || t.href.length > best.length) best = t.href;
  }
  return best ?? "/registrar/overview";
}

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) => matches(href, pathname, "/registrar/overview"),
    [pathname],
  );
}

function RegistrarNavbar({ tabs }: { tabs: NavItem[] }) {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Registrar sections">
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

function RegistrarRail({ groups }: { groups: NavGroup[] }) {
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

export function RegistrarSidebar() {
  const railScrollRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <>
      <aside className={`${styles.rail} ${styles.railDesktop}`} aria-label="Registrar sections">
        <div ref={railScrollRef} className={styles.railScroll}>
          <RegistrarRail groups={NAV} />
        </div>
        <div className={styles.railHintWrap}>
          <ScrollDownHint
            scrollRef={railScrollRef}
            watchKey="registrar-nav"
            label="Scroll for more"
            className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
          />
        </div>
      </aside>
      <div className={styles.tabsMobile}>
        <RegistrarNavbar tabs={TABS} />
      </div>
    </>
  );
}
