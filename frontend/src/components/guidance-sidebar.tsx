"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BellRing,
  Inbox,
  MessagesSquare,
  FilePenLine,
  Files,
  ClipboardList,
  Send,
  Flame,
  Settings,
  type LucideIcon,
} from "lucide-react";

import styles from "./guidance-sidebar.module.css";
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

// Guidance Counselor nav — branched left rail on desktop (same as the
// nurse/teacher desks), flattened tab bar on small screens. Referrals are
// split into two dedicated pages (ADM Cases and Counseling Cases) so the
// reader never needs the track filter; each page locks to its own track.
// Interventions live under Overview; Referrals Report covers the whole
// desk (ADM + counseling insights and reports). Sub-routes (risk heatmap /
// behavioral) stay under their parent tab via prefix matching, so no
// submenu is needed.
//
// Shared-concept convention (same label + icon across desks):
// Overview=LayoutDashboard, Alerts=BellRing, ADM Cases=Inbox,
// Interventions=ClipboardList, Anecdotal Records=FilePenLine,
// Referrals Report=Send, Risk Dashboard=Flame.
const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/guidance/overview", icon: LayoutDashboard },
      { title: "Alerts", href: "/guidance/alerts", icon: BellRing },
      {
        title: "Interventions",
        href: "/guidance/interventions",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "Referrals",
    items: [
      {
        title: "ADM Cases",
        href: "/guidance/referrals/adm",
        icon: Inbox,
      },
      {
        title: "Counseling Cases",
        href: "/guidance/referrals/counseling",
        icon: MessagesSquare,
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        title: "Anecdotal Records",
        href: "/guidance/anecdotal",
        icon: FilePenLine,
      },
      {
        title: "Session Documents",
        href: "/guidance/session-documents",
        icon: Files,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Referrals Report", href: "/guidance/adm", icon: Send },
      {
        title: "Risk Dashboard",
        href: "/guidance/risk",
        icon: Flame,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "General Settings",
        href: "/guidance/settings",
        icon: Settings,
      },
    ],
  },
];

// GitHub-style tab bar: every section flattened into one row under the
// topbar on small screens. Groups only group the source data, not the
// rendered tabs.
const TABS: NavItem[] = NAV.flatMap((group) => group.items);

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

function GuidanceNavbar({ tabs }: { tabs: NavItem[] }) {
  const isActive = useIsActive();

  return (
    <nav className={styles.navbar} aria-label="Guidance sections">
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

function GuidanceRail({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = React.useCallback(
    (href: string) =>
      href === "/guidance/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
  const tabs = groups.flatMap((group) => group.items);
  const activeHref = tabs.find((t) => isActive(t.href))?.href ?? "/guidance/overview";
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

export function GuidanceSidebar() {
  const railScrollRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <>
      <aside className={`${styles.rail} ${styles.railDesktop}`} aria-label="Guidance sections">
        <div ref={railScrollRef} className={styles.railScroll}>
          <GuidanceRail groups={NAV} />
        </div>
        <div className={styles.railHintWrap}>
          <ScrollDownHint
            scrollRef={railScrollRef}
            watchKey="guidance-nav"
            label="Scroll for more"
            className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
          />
        </div>
      </aside>
      <div className={styles.tabsMobile}>
        <GuidanceNavbar tabs={TABS} />
      </div>
    </>
  );
}
