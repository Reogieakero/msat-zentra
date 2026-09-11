"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  FilePenLine,
  BellRing,
  ClipboardList,
  Send,
  Flame,
  ChevronDown,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import styles from "./guidance-sidebar.module.css";

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

// Placeholder nav — mock-up only, no data fetching. Mirrors the Guidance
// Counselor scope: referred cases, anecdotal records, interventions,
// ADM hand-off, and school-wide risk views.
const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/guidance/overview", icon: LayoutDashboard },
      { title: "Alerts", href: "/guidance/alerts", icon: BellRing, badge: "12" },
    ],
  },
  {
    label: "Cases",
    items: [
      {
        title: "Referrals to Me",
        href: "/guidance/referrals",
        icon: Inbox,
        badge: "8",
      },
      {
        title: "Anecdotal Records",
        href: "/guidance/anecdotal",
        icon: FilePenLine,
      },
    ],
  },
  {
    label: "Intervention",
    items: [
      {
        title: "Interventions",
        href: "/guidance/interventions",
        icon: ClipboardList,
        badge: "5",
      },
      { title: "ADM Referrals", href: "/guidance/adm", icon: Send },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        title: "Risk Dashboard",
        href: "/guidance/risk",
        icon: Flame,
        subItems: [
          { title: "Heatmap", href: "/guidance/risk/heatmap" },
          { title: "Behavioral", href: "/guidance/risk/behavioral" },
        ],
      },
    ],
  },
];

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) =>
      href === "/guidance/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function SidebarNav() {
  const isActive = useIsActive();
  const pathname = usePathname();
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

export function GuidanceSidebar() {
  return <SidebarShell />;
}
