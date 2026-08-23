"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  ShieldAlert,
  FileSignature,
  Award,
  FileBarChart,
  ShieldCheck,
  PanelLeft,
  Check,
  ChevronDown,
} from "lucide-react";

import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./staff-sidebar.module.css";

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

const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/principal/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Manage",
    items: [
      { title: "Academics", href: "/principal/academics", icon: GraduationCap },
      {
        title: "Risk Board",
        href: "/principal/risk",
        icon: ShieldAlert,
        subItems: [
          { title: "Students", href: "/principal/risk/students" },
          { title: "Heat Map", href: "/principal/risk/heat-map" },
          { title: "Interventions", href: "/principal/risk/interventions" },
        ],
      },
      {
        title: "ADM Cases",
        href: "/principal/adm",
        icon: FileSignature,
        badge: "2",
        subItems: [
          { title: "Referrals", href: "/principal/adm/referrals" },
          { title: "Approvals", href: "/principal/adm/approvals" },
        ],
      },
      {
        title: "Honor Roll",
        href: "/principal/honor-roll",
        icon: Award,
        subItems: [
          { title: "Grade 7", href: "/principal/honor-roll/7" },
          { title: "Grade 8", href: "/principal/honor-roll/8" },
          { title: "Grade 9", href: "/principal/honor-roll/9" },
          { title: "Grade 10", href: "/principal/honor-roll/10" },
          { title: "Grade 11", href: "/principal/honor-roll/11" },
          { title: "Grade 12", href: "/principal/honor-roll/12" },
        ],
      },
    ],
  },
  {
    label: "Reports & Admin",
    items: [
      { title: "Reports", href: "/principal/reports", icon: FileBarChart },
      { title: "Audit Log", href: "/principal/audit", icon: ShieldCheck },
    ],
  },
];

export type SidebarMode = "hover" | "expanded" | "collapsible";

const MODE_LABELS: Record<SidebarMode, string> = {
  hover: "Expand on hover",
  expanded: "Expanded",
  collapsible: "Collapsible",
};

function useIsActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) =>
      href === "/principal/dashboard"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function SidebarShell({
  expanded,
  hoverWidth,
  onHoverChange,
  mode,
  onModeChange,
}: {
  expanded: boolean;
  hoverWidth: boolean;
  onHoverChange: (hovered: boolean) => void;
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
}) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const isActive = useIsActive();
  const collapsed = isMobile ? false : !expanded;
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    "/principal/adm": true,
    "/principal/risk": true,
  });

  const renderItem = (item: NavItem, nested = false) => {
    const active = isActive(item.href);
    const hasSub = !!item.subItems?.length;
    const open = openGroups[item.href] ?? false;
    const subActive = item.subItems?.some((s) => isActive(s.href)) ?? false;

    if (hasSub && !nested) {
      return (
        <li key={item.href}>
          <button
            type="button"
            className={`${styles.item} ${subActive ? styles.itemActive : ""}`}
            onClick={() =>
              setOpenGroups((prev) => ({ ...prev, [item.href]: !prev[item.href] }))
            }
            aria-expanded={open}
          >
            <item.icon className={styles.itemIcon} />
            <span className={styles.itemLabel}>{item.title}</span>
            {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
            <ChevronDown
              className={`${styles.itemChevron} ${open ? styles.itemChevronOpen : ""}`}
            />
          </button>
          {open ? (
            <ul className={styles.submenu}>
              {item.subItems!.map((sub) => {
                const subIsActive = isActive(sub.href);
                return (
                  <li key={sub.href}>
                    <Link
                      href={sub.href}
                      className={`${styles.subitem} ${
                        subIsActive ? styles.itemActive : ""
                      }`}
                      aria-current={subIsActive ? "page" : undefined}
                    >
                      <span className={styles.itemLabel}>{sub.title}</span>
                      {sub.badge ? <span className={styles.badge}>{sub.badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </li>
      );
    }

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={`${styles.item} ${nested ? styles.subitem : ""} ${
            active ? styles.itemActive : ""
          }`}
          title={collapsed ? item.title : undefined}
          aria-current={active ? "page" : undefined}
        >
          <item.icon className={styles.itemIcon} />
          <span className={styles.itemLabel}>{item.title}</span>
          {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
        </Link>
      </li>
    );
  };

  const aside = (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""} ${
        hoverWidth ? styles.hoverWidth : ""
      }`}
      data-state={expanded ? "expanded" : "collapsed"}
      data-collapsible="icon"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <nav className={styles.content}>
        <ul className={styles.menu}>
          {NAV.flatMap((group) => group.items.map((item) => renderItem(item)))}
        </ul>
      </nav>

      <div className={styles.footer}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={styles.settingsButton}
              aria-label="Sidebar settings"
              title="Sidebar settings"
            >
              <PanelLeft className={styles.itemIcon} />
              <span className={styles.itemLabel}>Sidebar</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className={styles.settingsMenu}
          >
            <DropdownMenuLabel>Sidebar settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(MODE_LABELS) as SidebarMode[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onSelect={() => onModeChange(key)}
                className={styles.settingsItem}
              >
                <span className={styles.settingsItemLabel}>{MODE_LABELS[key]}</span>
                {mode === key ? <Check className={styles.settingsCheck} /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        <div
          className={`${styles.scrim} ${openMobile ? styles.scrimOpen : ""}`}
          onClick={() => setOpenMobile(false)}
        />
        <div
          className={`${styles.mobile} ${openMobile ? styles.mobileOpen : ""}`}
        >
          {aside}
        </div>
      </>
    );
  }

  return aside;
}

export function StaffSidebar({
  expanded,
  hoverWidth,
  onHoverChange,
  mode,
  onModeChange,
}: {
  expanded: boolean;
  hoverWidth: boolean;
  onHoverChange: (hovered: boolean) => void;
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
}) {
  return (
    <SidebarShell
      expanded={expanded}
      hoverWidth={hoverWidth}
      onHoverChange={onHoverChange}
      mode={mode}
      onModeChange={onModeChange}
    />
  );
}


