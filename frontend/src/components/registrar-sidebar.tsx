"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Award,
  UserCheck,
  ShieldQuestion,
  GraduationCap,
  FileBarChart,
  FileText,
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
import styles from "./registrar-sidebar.module.css";

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
      { title: "Overview", href: "/registrar/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Records",
    items: [
      { title: "Final Grade Approvals", href: "/registrar/final-grades", icon: Award },
      { title: "Account Approvals", href: "/registrar/accounts", icon: UserCheck, badge: "MOCK" },
      { title: "Adviser Access Requests", href: "/registrar/adviser-access", icon: ShieldQuestion, badge: "MOCK" },
      { title: "Sections & Subjects", href: "/registrar/academics", icon: GraduationCap },
      { title: "Report Cards", href: "/registrar/report-cards", icon: FileBarChart },
      { title: "SF10 Records", href: "/registrar/sf10", icon: FileText },
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
      href === "/registrar/overview"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );
}

function SidebarShell({
  expanded,
  hovering,
  onHoverChange,
  mode,
  onModeChange,
}: {
  expanded: boolean;
  hovering: boolean;
  onHoverChange: (hovered: boolean) => void;
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
}) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const isActive = useIsActive();
  const router = useRouter();
  const collapsed = isMobile ? false : !expanded;

  const renderItem = (item: NavItem, nested = false) => {
    const active = isActive(item.href);
    const hasSub = !!item.subItems?.length;

    if (hasSub && !nested) {
      return (
        <li key={item.href}>
          <button
            type="button"
            className={`${styles.item} ${active ? styles.itemActive : ""}`}
            onClick={() => router.push(item.href)}
            aria-expanded={false}
          >
            <item.icon className={styles.itemIcon} />
            <span className={styles.itemLabel}>{item.title}</span>
            {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
            <ChevronDown className={styles.itemChevron} />
          </button>
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
        hovering ? styles.hoverElevated : ""
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

export function RegistrarSidebar({
  expanded,
  hovering,
  onHoverChange,
  mode,
  onModeChange,
}: {
  expanded: boolean;
  hovering: boolean;
  onHoverChange: (hovered: boolean) => void;
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
}) {
  return (
    <SidebarShell
      expanded={expanded}
      hovering={hovering}
      onHoverChange={onHoverChange}
      mode={mode}
      onModeChange={onModeChange}
    />
  );
}
