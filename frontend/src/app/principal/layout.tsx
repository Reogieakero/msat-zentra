"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/providers";
import { StaffSidebar, type SidebarMode } from "@/components/staff-sidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandInput,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Sun, Moon, UserRound, LogOut, Menu, X } from "lucide-react";
import { GradeModeProvider, useGradeMode } from "./grade-mode-context";
import styles from "./principal.module.css";

const STORAGE_KEY = "zentra.sidebar.mode";

function GradeBasisSelector() {
  const { gradeMode, setGradeMode } = useGradeMode();
  return (
    <div className={styles.accountGradeBasis}>
      <span className={styles.accountGroupLabel}>Grade basis</span>
      <div className={styles.segmentedCompact} role="group" aria-label="Grade basis">
        <button
          type="button"
          className={`${styles.segmentCompact} ${gradeMode === "final" ? styles.segmentCompactOn : ""}`}
          aria-pressed={gradeMode === "final"}
          onClick={() => setGradeMode("final")}
        >
          Final
        </button>
        <button
          type="button"
          className={`${styles.segmentCompact} ${gradeMode === "raw" ? styles.segmentCompactOn : ""}`}
          aria-pressed={gradeMode === "raw"}
          onClick={() => setGradeMode("raw")}
        >
          Raw
        </button>
      </div>
    </div>
  );
}

function PrincipalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { open, setOpen, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<SidebarMode>("hover");

  React.useEffect(() => {
    setMounted(true);
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "hover" || saved === "expanded" || saved === "collapsible") {
      setMode(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const hovering = mode === "hover" && hovered && !open;
  const expanded =
    open || (mode === "hover" && hovered && !open) || (mode === "expanded" && !isMobile);

  const handleModeChange = (next: SidebarMode) => {
    setMode(next);
    setOpen(next === "expanded");
  };

  const isDark = mounted && resolvedTheme === "dark";

  const handleLogout = () => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("zentra."))
      .forEach((key) => window.localStorage.removeItem(key));
    router.push("/login");
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label={openMobile ? "Close sidebar" : "Open sidebar"}
          aria-expanded={openMobile}
          onClick={() => setOpenMobile(!openMobile)}
        >
          {openMobile ? (
            <X className={styles.menuIcon} />
          ) : (
            <Menu className={styles.menuIcon} />
          )}
        </button>

        <Link href="/principal/overview" className={styles.brand}>
          <span className={styles.brandText}>Zentra</span>
        </Link>

        <div className={styles.spacer} />

        <div className={styles.search}>
          <Command shouldFilter={false} className={styles.searchCommand}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search…"
            />
          </Command>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={styles.avatarButton}
              aria-label="Account menu"
            >
              <Avatar size="sm">
                <AvatarFallback>
                  <UserRound className={styles.avatarIcon} />
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.accountMenu}>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={styles.accountItem}>
              <Settings className={styles.accountIcon} />
              <span>Settings</span>
            </DropdownMenuItem>
            <div className={styles.accountGroup}>
              <div className={styles.accountGroupLabel}>
                <span>System Preference</span>
              </div>
              <DropdownMenuItem
                className={`${styles.accountItem} ${styles.accountSubItem}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setTheme("light");
                }}
              >
                <Sun className={styles.accountIcon} />
                <span>Light</span>
                {!isDark ? (
                  <span className={styles.accountCheck}>Active</span>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`${styles.accountItem} ${styles.accountSubItem}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setTheme("dark");
                }}
              >
                <Moon className={styles.accountIcon} />
                <span>Dark</span>
                {isDark ? (
                  <span className={styles.accountCheck}>Active</span>
                ) : null}
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <div className={styles.accountGroup}>
              <GradeBasisSelector />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={styles.accountItem}
              onSelect={(event) => {
                event.preventDefault();
                handleLogout();
              }}
            >
              <LogOut className={styles.accountIcon} />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <StaffSidebar
        expanded={expanded}
        hovering={hovering}
        onHoverChange={setHovered}
        mode={mode}
        onModeChange={handleModeChange}
      />
      <div
        className={`${styles.shell} ${
          mode === "expanded" && !isMobile ? styles.shellExpanded : ""
        }`}
      >
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}

export default function PrincipalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <GradeModeProvider>
        <PrincipalShell>{children}</PrincipalShell>
      </GradeModeProvider>
    </SidebarProvider>
  );
}
