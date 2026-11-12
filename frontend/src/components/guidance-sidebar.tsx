"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import styles from "./guidance-sidebar.module.css";
import BranchedMenu from "./nav/BranchedMenu";
import { NAV_ICONS } from "./nav/sidebar-icons";
import { SidebarIconRail } from "./nav/SidebarIconRail";
import { ScrollDownHint } from "@/components/ui/scroll-down-hint";
import {
  useGuidanceNavDots,
  type GuidanceNavDots,
} from "@/services/guidance/navCounts.service";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Numeric/text pill (unused on the guidance desk — it shows a dot). */
  badge?: string;
  /** Red "new or updated since you last looked" dot. */
  dot?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Overview", href: "/guidance/overview", icon: NAV_ICONS.overview },
      { title: "Alerts", href: "/guidance/alerts", icon: NAV_ICONS.alerts },
      { title: "Schedule", href: "/guidance/schedule", icon: NAV_ICONS.schedule },
      {
        title: "Interventions",
        href: "/guidance/interventions",
        icon: NAV_ICONS.interventions,
      },
    ],
  },
  {
    label: "Referrals",
    items: [
      {
        title: "ADM Cases",
        href: "/guidance/referrals/adm",
        icon: NAV_ICONS.admCases,
      },
      {
        title: "Counseling Cases",
        href: "/guidance/referrals/counseling",
        icon: NAV_ICONS.counselingCases,
      },
    ],
  },
  {
    label: "Records",
    items: [
      {
        title: "Anecdotal Records",
        href: "/guidance/anecdotal",
        icon: NAV_ICONS.anecdotal,
      },
      {
        title: "Session Documents",
        href: "/guidance/session-documents",
        icon: NAV_ICONS.sessionDocuments,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        title: "Intervention Insights",
        href: "/guidance/interventions/insights",
        icon: NAV_ICONS.interventionInsights,
      },
      { title: "Referrals Report", href: "/guidance/adm", icon: NAV_ICONS.referrals },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "General Settings",
        href: "/guidance/settings",
        icon: NAV_ICONS.settings,
      },
    ],
  },
];

/* Which live queue each nav entry watches. The dot comes from
   `/api/guidance/nav-counts`; a queue with nothing unseen shows no dot. */
const QUEUE_FOR_HREF: Record<string, keyof GuidanceNavDots> = {
  "/guidance/overview": "overview",
  "/guidance/alerts": "alerts",
  "/guidance/interventions": "interventions",
  "/guidance/interventions/insights": "insights",
  "/guidance/schedule": "schedule",
  "/guidance/referrals/adm": "adm",
  "/guidance/referrals/counseling": "counseling",
  "/guidance/anecdotal": "anecdotal",
  "/guidance/session-documents": "documents",
  "/guidance/adm": "report",
};

function withDots(groups: NavGroup[], dots?: GuidanceNavDots): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      dot: Boolean(
        dots && QUEUE_FOR_HREF[item.href] ? dots[QUEUE_FOR_HREF[item.href]] : false,
      ),
    })),
  }));
}

/* Parent desks whose nested pages have their own nav entry (intervention
   insights lives under /guidance/interventions) must highlight exactly. */
const EXACT_MATCH = new Set(["/guidance/overview", "/guidance/interventions"]);

function isNavActive(pathname: string, href: string) {
  return EXACT_MATCH.has(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) => isNavActive(pathname, href),
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
                {item.dot ? (
                  <span className={styles.dot} aria-hidden="true" />
                ) : null}
                {item.dot ? <span className="sr-only">New activity</span> : null}
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
    (href: string) => isNavActive(pathname, href),
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

export function GuidanceSidebar({
  collapsed = true,
}: {
  collapsed?: boolean;
} = {}) {
  const railScrollRef = React.useRef<HTMLDivElement | null>(null);
  const isActive = useIsActive();
  const counts = useGuidanceNavDots();
  const nav = React.useMemo(() => withDots(NAV, counts), [counts]);
  const tabs = React.useMemo(() => nav.flatMap((group) => group.items), [nav]);
  const activeHref =
    tabs.find((t) => isActive(t.href))?.href ?? "/guidance/overview";

  return (
    <>
      <aside
        className={`${styles.rail} ${styles.railDesktop} ${collapsed ? styles.railCollapsed : ""}`}
        aria-label="Guidance sections"
      >
        {collapsed ? (
          <SidebarIconRail
            groups={nav}
            ariaLabel="Guidance sections, icon only"
            activeHref={activeHref}
          />
        ) : (
          <>
            <div ref={railScrollRef} className={styles.railScroll}>
              <GuidanceRail groups={nav} />
            </div>
            <div className={styles.railHintWrap}>
              <ScrollDownHint
                scrollRef={railScrollRef}
                watchKey="guidance-nav"
                label="Scroll for more"
                className="pointer-events-auto rounded-full border border-border bg-card px-3 py-1 shadow-sm"
              />
            </div>
          </>
        )}
      </aside>
      <div className={styles.tabsMobile}>
        <GuidanceNavbar tabs={tabs} />
      </div>
    </>
  );
}
