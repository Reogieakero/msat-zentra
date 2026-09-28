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
  ChevronDown,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import styles from "./principal-navbar.module.css";

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

// Same sections as the old sidebar, flattened into one GitHub-style tab row
// like the nurse / teacher / guidance / coordinator desks. Parents with
// subItems (Risk Board, ADM Cases) keep their parent link AND get a chevron
// that opens a dropdown on hover or click.
const NAV_ITEMS: NavItem[] = [
  { title: "Overview", href: "/principal/overview", icon: LayoutDashboard },
  {
    title: "Academics",
    href: "/principal/academics",
    icon: GraduationCap,
    subItems: [
      { title: "Assigning", href: "/principal/academics/assign" },
      { title: "Schedule Approval", href: "/principal/academics/schedule" },
    ],
  },
  {
    title: "Risk Board",
    href: "/principal/risk",
    icon: ShieldAlert,
    subItems: [
      { title: "Students", href: "/principal/risk/students" },
      {
        title: "Attendance Heatmap",
        href: "/principal/risk/heatmaps/attendance",
      },
      {
        title: "Academic Heatmap",
        href: "/principal/risk/heatmaps/academics",
      },
      {
        title: "Behavioral Records",
        href: "/principal/risk/heatmaps/records",
      },
      { title: "Interventions", href: "/principal/risk/interventions" },
    ],
  },
  {
    title: "ADM Cases",
    href: "/principal/adm",
    icon: FileSignature,
    subItems: [
      { title: "Referrals", href: "/principal/adm/referrals/all" },
      { title: "ADM Reports", href: "/principal/adm/approvals/all" },
    ],
  },
  { title: "Honor Roll", href: "/principal/honor-roll", icon: Award },
  { title: "Reports", href: "/principal/reports", icon: FileBarChart },
  { title: "Audit Log", href: "/principal/audit", icon: ShieldCheck },
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

export function PrincipalNavbar() {
  const pathname = usePathname();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const isActive = useIsActive();
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);
  const [dropPos, setDropPos] = React.useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const navRef = React.useRef<HTMLElement>(null);
  const tabsRef = React.useRef<HTMLUListElement>(null);
  const itemRefs = React.useRef(new Map<string, HTMLLIElement>());
  const closeTimer = React.useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const positionDropdown = React.useCallback((href: string) => {
    const el = itemRefs.current.get(href);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropPos({
      top: rect.bottom + 4,
      // Keep the panel on-screen on narrow widths.
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 232)),
    });
  }, []);

  const openNow = (href: string) => {
    clearCloseTimer();
    setOpenMenu(href);
    // Measure after paint so the li rect is current (tabs may scroll).
    requestAnimationFrame(() => positionDropdown(href));
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 150);
  };

  const toggle = (href: string) => {
    clearCloseTimer();
    setOpenMenu((prev) => {
      const next = prev === href ? null : href;
      if (next) requestAnimationFrame(() => positionDropdown(next));
      return next;
    });
  };

  // Close dropdown on route change.
  React.useEffect(() => {
    setOpenMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close the mobile drawer on route change.
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on Escape + click outside (desktop dropdown).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    const onPointer = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      clearCloseTimer();
    };
  }, []);

  // Keep the fixed-position dropdown glued under its tab while the tab row
  // scrolls horizontally or the window resizes/scrolls.
  React.useEffect(() => {
    if (!openMenu || isMobile) return;
    const update = () => positionDropdown(openMenu);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const tabs = tabsRef.current;
    tabs?.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      tabs?.removeEventListener("scroll", update);
    };
  }, [openMenu, isMobile, positionDropdown]);

  if (isMobile) {
    return (
      <>
        <div
          className={`${styles.scrim} ${openMobile ? styles.scrimOpen : ""}`}
          onClick={() => setOpenMobile(false)}
          aria-hidden="true"
        />
        <nav
          ref={navRef}
          aria-label="Principal"
          className={`${styles.mobile} ${openMobile ? styles.mobileOpen : ""}`}
        >
          <ul className={styles.mobileList}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const hasSub = !!item.subItems?.length;
              const expanded = openMenu === item.href;
              const subActive =
                item.subItems?.some((s) => isActive(s.href)) ?? false;
              return (
                <li key={item.href} className={styles.mobileItem}>
                  <div
                    className={`${styles.mobileRow} ${
                      active || subActive ? styles.mobileRowActive : ""
                    }`}
                  >
                    <Link
                      href={item.href}
                      className={styles.mobileLink}
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        setOpenMobile(false);
                        setOpenMenu(null);
                      }}
                    >
                      <item.icon className={styles.rowIcon} />
                      <span className={styles.rowLabel}>{item.title}</span>
                      {item.badge ? (
                        <span className={styles.badge}>{item.badge}</span>
                      ) : null}
                    </Link>
                    {hasSub ? (
                      <button
                        type="button"
                        className={styles.chevButtonMobile}
                        aria-label={`Toggle ${item.title} submenu`}
                        aria-expanded={expanded}
                        onClick={() => toggle(item.href)}
                      >
                        <ChevronDown
                          className={`${styles.chev} ${expanded ? styles.chevOpen : ""}`}
                        />
                      </button>
                    ) : null}
                  </div>
                  {hasSub ? (
                    <ul
                      className={`${styles.mobileSub} ${expanded ? styles.mobileSubOpen : ""}`}
                    >
                      {item.subItems!.map((sub) => {
                        const subIsActive = isActive(sub.href);
                        return (
                          <li key={sub.href}>
                            <Link
                              href={sub.href}
                              className={`${styles.mobileSubLink} ${
                                subIsActive ? styles.mobileSubLinkActive : ""
                              }`}
                              aria-current={
                                subIsActive ? "page" : undefined
                              }
                              onClick={() => {
                                setOpenMobile(false);
                                setOpenMenu(null);
                              }}
                            >
                              {sub.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>
      </>
    );
  }

  return (
    <nav ref={navRef} aria-label="Principal" className={styles.navbar}>
      <ul ref={tabsRef} className={styles.tabs}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const hasSub = !!item.subItems?.length;
          const open = openMenu === item.href;
          const subActive =
            item.subItems?.some((s) => isActive(s.href)) ?? false;
          const tabActive = active || subActive;
          return (
            <li
              key={item.href}
              ref={(el) => {
                if (el) itemRefs.current.set(item.href, el);
                else itemRefs.current.delete(item.href);
              }}
              className={styles.tabItem}
              onMouseEnter={() => {
                if (hasSub) openNow(item.href);
              }}
              onMouseLeave={() => {
                if (hasSub) scheduleClose();
              }}
            >
              <div
                className={`${styles.tab} ${tabActive ? styles.tabActive : ""} ${open ? styles.tabOpen : ""}`}
              >
                <Link
                  href={item.href}
                  className={styles.tabLink}
                  aria-current={active ? "page" : undefined}
                  aria-haspopup={hasSub ? "menu" : undefined}
                  aria-expanded={hasSub ? open : undefined}
                  onFocus={() => {
                    if (hasSub) openNow(item.href);
                  }}
                  onClick={() => setOpenMenu(null)}
                >
                  <item.icon className={styles.tabIcon} aria-hidden="true" />
                  <span className={styles.tabLabel}>{item.title}</span>
                  {item.badge ? (
                    <span className={styles.badge}>{item.badge}</span>
                  ) : null}
                </Link>
                {hasSub ? (
                  <button
                    type="button"
                    className={styles.chevButton}
                    aria-label={`Toggle ${item.title} submenu`}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(item.href);
                    }}
                    onMouseEnter={() => openNow(item.href)}
                  >
                    <ChevronDown
                      className={`${styles.chev} ${open ? styles.chevOpen : ""}`}
                    />
                  </button>
                ) : null}
              </div>
              {/* Rendered only when open, fixed-positioned so the
                  horizontally-scrolling tab row can never clip it. */}
              {hasSub && open ? (
                <ul
                  role="menu"
                  aria-label={`${item.title} submenu`}
                  className={styles.dropdown}
                  style={{ top: dropPos.top, left: dropPos.left }}
                  onMouseEnter={() => openNow(item.href)}
                  onMouseLeave={() => scheduleClose()}
                >
                  {item.subItems!.map((sub) => {
                    const subIsActive = isActive(sub.href);
                    return (
                      <li key={sub.href} role="none">
                        <Link
                          role="menuitem"
                          href={sub.href}
                          className={`${styles.dropLink} ${
                            subIsActive ? styles.dropLinkActive : ""
                          }`}
                          aria-current={subIsActive ? "page" : undefined}
                          onClick={() => setOpenMenu(null)}
                        >
                          {sub.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
