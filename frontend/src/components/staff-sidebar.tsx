"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardCheck,
  CalendarDays,
  BellRing,
  FileBarChart,
  Settings,
  ShieldCheck,
  BookOpen,
  PanelLeft,
  Check,
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

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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
      { title: "Dashboard", href: "/principal/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Manage",
    items: [
      { title: "Learners", href: "/principal/learners", icon: Users },
      { title: "Teachers", href: "/principal/teachers", icon: GraduationCap },
      { title: "Sections", href: "/principal/sections", icon: BookOpen },
      { title: "Attendance", href: "/principal/attendance", icon: ClipboardCheck },
      { title: "Calendar", href: "/principal/calendar", icon: CalendarDays },
      {
        title: "Interventions",
        href: "/principal/interventions",
        icon: BellRing,
        badge: "3",
      },
    ],
  },
  {
    label: "Reports & Admin",
    items: [
      { title: "Reports", href: "/principal/reports", icon: FileBarChart },
      { title: "Audit Log", href: "/principal/audit", icon: ShieldCheck },
      { title: "Settings", href: "/principal/settings", icon: Settings },
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
      href === "/principal/overview"
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
          {NAV.flatMap((group) =>
            group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${styles.item} ${active ? styles.itemActive : ""}`}
                    title={collapsed ? item.title : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    <item.icon className={styles.itemIcon} />
                    <span className={styles.itemLabel}>{item.title}</span>
                    {item.badge ? (
                      <span className={styles.badge}>{item.badge}</span>
                    ) : null}
                  </Link>
                </li>
              );
            }),
          )}
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


