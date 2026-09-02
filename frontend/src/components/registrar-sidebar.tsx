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
  ChevronDown,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
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
      { title: "Final Grades", href: "/registrar/final-grades", icon: Award },
      { title: "Account Approvals", href: "/registrar/accounts", icon: UserCheck },
      { title: "Adviser Access Requests", href: "/registrar/adviser-access", icon: ShieldQuestion, badge: "MOCK" },
      { title: "Sections & Subjects", href: "/registrar/academics", icon: GraduationCap },
      { title: "Report Cards", href: "/registrar/report-cards", icon: FileBarChart },
      { title: "SF10 Records", href: "/registrar/sf10", icon: FileText },
    ],
  },
];

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

function SidebarNav() {
  const isActive = useIsActive();
  const router = useRouter();

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
    <ul className={styles.menu}>
      {NAV.flatMap((group) => group.items.map((item) => renderItem(item)))}
    </ul>
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

export function RegistrarSidebar() {
  return <SidebarShell />;
}