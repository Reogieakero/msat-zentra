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
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
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
      { title: "Overview", href: "/principal/overview", icon: LayoutDashboard },
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
          { title: "Attendance Heatmap", href: "/principal/risk/heatmaps/attendance" },
          { title: "Academic Heatmap", href: "/principal/risk/heatmaps/academics" },
          { title: "Behavioral Records", href: "/principal/risk/heatmaps/records" },
          { title: "Interventions", href: "/principal/risk/interventions" },
        ],
      },
      {
        title: "ADM Cases",
        href: "/principal/adm",
        icon: FileSignature,
        subItems: [
          { title: "Referrals", href: "/principal/adm/referrals/all" },
          { title: "Approvals", href: "/principal/adm/approvals/all" },
        ],
      },
      {
        title: "Honor Roll",
        href: "/principal/honor-roll",
        icon: Award,
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

function SidebarShell() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const isActive = useIsActive();

  const renderItem = (item: NavItem, nested = false) => {
    const active = isActive(item.href);
    const hasSub = !!item.subItems?.length;
    const subActive = item.subItems?.some((s) => isActive(s.href)) ?? false;

    if (hasSub && !nested) {
      return (
        <li key={item.href}>
          <Link
            href={item.href}
            className={`${styles.item} ${subActive ? styles.itemActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className={styles.itemIcon} />
            <span className={styles.itemLabel}>{item.title}</span>
            {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
          </Link>
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
    <aside className={styles.sidebar} data-state="expanded">
      <nav className={styles.content}>
        <ul className={styles.menu}>
          {NAV.flatMap((group) => group.items.map((item) => renderItem(item)))}
        </ul>
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

export function StaffSidebar() {
  return <SidebarShell />;
}

