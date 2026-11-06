"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "@/components/providers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./kanban-account-menu.module.css";

type KanbanAccountMenuProps = {
  /** Desk settings route, e.g. "/teacher/settings". */
  settingsHref: string;
  /** Desk logout handler (clears caches and session, then redirects). */
  onLogout: () => void;
  /** The desk's avatar button, used unchanged as the trigger. */
  children: React.ReactNode;
};

/**
 * Account dropdown drawn as a three-column kanban board:
 * Account (settings) · Appearance (light/dark) · Session (logout).
 * Shared by every desk navbar so the menu stays consistent.
 */
export function KanbanAccountMenu({
  settingsHref,
  onLogout,
  children,
}: KanbanAccountMenuProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={styles.menu}
        aria-label="Account board"
      >
        <div className={styles.board}>
          <section className={styles.column} aria-label="Account">
            <div className={styles.columnHeader}>
              <span className={styles.columnHeading}>
                <span
                  className={`${styles.columnDot} ${styles.dotPrimary}`}
                  aria-hidden="true"
                />
                <span className={styles.columnTitle}>Account</span>
              </span>
              <span className={styles.columnCount}>1</span>
            </div>
            <div className={styles.cards}>
              <DropdownMenuItem
                className={styles.card}
                onSelect={(event) => {
                  event.preventDefault();
                  router.push(settingsHref);
                }}
              >
                <span
                  className={`${styles.cardIcon} ${styles.iconPrimary}`}
                  aria-hidden="true"
                >
                  <Settings className="size-3.5" />
                </span>
                <span className={styles.cardTitle}>Settings</span>
              </DropdownMenuItem>
            </div>
          </section>

          <section className={styles.column} aria-label="Appearance">
            <div className={styles.columnHeader}>
              <span className={styles.columnHeading}>
                <span
                  className={`${styles.columnDot} ${styles.dotViolet}`}
                  aria-hidden="true"
                />
                <span className={styles.columnTitle}>Appearance</span>
              </span>
              <span className={styles.columnCount}>2</span>
            </div>
            <div className={styles.cards}>
              <DropdownMenuItem
                className={`${styles.card} ${isDark ? "" : styles.cardActive}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setTheme("light");
                }}
              >
                <span
                  className={`${styles.cardIcon} ${styles.iconLight}`}
                  aria-hidden="true"
                >
                  <Sun className="size-3.5" />
                </span>
                <span className={styles.cardTitle}>Light</span>
                {isDark ? null : <span className={styles.cardBadge}>Active</span>}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`${styles.card} ${isDark ? styles.cardActive : ""}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setTheme("dark");
                }}
              >
                <span
                  className={`${styles.cardIcon} ${styles.iconDark}`}
                  aria-hidden="true"
                >
                  <Moon className="size-3.5" />
                </span>
                <span className={styles.cardTitle}>Dark</span>
                {isDark ? <span className={styles.cardBadge}>Active</span> : null}
              </DropdownMenuItem>
            </div>
          </section>

          <section className={styles.column} aria-label="Session">
            <div className={styles.columnHeader}>
              <span className={styles.columnHeading}>
                <span
                  className={`${styles.columnDot} ${styles.dotDanger}`}
                  aria-hidden="true"
                />
                <span className={styles.columnTitle}>Session</span>
              </span>
              <span className={styles.columnCount}>1</span>
            </div>
            <div className={styles.cards}>
              <DropdownMenuItem
                className={`${styles.card} ${styles.cardDanger}`}
                onSelect={(event) => {
                  event.preventDefault();
                  onLogout();
                }}
              >
                <span
                  className={`${styles.cardIcon} ${styles.iconDanger}`}
                  aria-hidden="true"
                >
                  <LogOut className="size-3.5" />
                </span>
                <span className={styles.cardTitle}>Logout</span>
              </DropdownMenuItem>
            </div>
          </section>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
