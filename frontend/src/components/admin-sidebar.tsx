"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import styles from "./admin-sidebar.module.css";
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

const ROOT = "/admin/overview";

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Overview", href: ROOT, icon: NAV_ICONS.overview }],
  },
  {
    label: "Administration",
    items: [
      {
        title: "User Accounts",
        href: "/admin/users",
        icon: NAV_ICONS.accountApprovals,
      },
      {
        title: "Audit Log",
        href: "/admin/audit",
        icon: NAV_ICONS.auditLog,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "Settings",
        href: "/admin/settings",
        icon: NAV_ICONS.settings,
      },
    ],
  },
];

const TABS: NavItem[] = NAV.flatMap((group) => group.items);

function matches(href: string, pathname: string) {
  if (href === ROOT) return pathname === href || pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveHref(tabs: NavItem[], pathname: string) {
  let best: string | null = null;
  for (const t of tabs) {
    if (!matches(t.href, pathname)) continue;
    if (best === null || t.href.length > best.length) best = t.href;
  }
  return best ?? ROOT;
}

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback((href: string) => matches(href, pathname), [pathname]);
}

function AdminNavbar({ tabs }: { tabs: NavItem[] }) {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Administrator sections">
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AdminRail({ groups }: { groups: NavGroup[] }) {
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

export function AdminSidebar({
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
        aria-label="Administrator sections"
      >
        {collapsed ? (
          <SidebarIconRail
            groups={NAV}
            ariaLabel="Administrator sections, icon only"
            activeHref={activeHref}
          />
        ) : (
          <>
            <div ref={railScrollRef} className={styles.railScroll}>
              <AdminRail groups={NAV} />
            </div>
            <div className={styles.railHintWrap}>
              <ScrollDownHint
                scrollRef={railScrollRef}
                watchKey="admin-nav"
                label="Scroll for more"
                className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
              />
            </div>
          </>
        )}
      </aside>
      <div className={styles.tabsMobile}>
        <AdminNavbar tabs={TABS} />
      </div>
    </>
  );
}
