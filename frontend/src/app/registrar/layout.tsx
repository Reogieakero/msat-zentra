"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme, useFont } from "@/components/providers";
import { RegistrarSidebar, type SidebarMode } from "@/components/registrar-sidebar";
import { SidebarModeContext } from "@/components/sidebar-mode";
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
import { Settings, Sun, Moon, UserRound, LogOut, Menu, X, Type } from "lucide-react";
import styles from "./registrar.module.css";

const STORAGE_KEY = "zentra.sidebar.mode";

function RegistrarShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { open, setOpen, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar();
  const { resolvedTheme, setTheme } = useTheme();
  const { font, setFont } = useFont();
  const [hovered, setHovered] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<SidebarMode>(() => {
    if (typeof window === "undefined") return "hover";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "hover" || saved === "expanded" || saved === "collapsible") {
      return saved;
    }
    return "hover";
  });

  const [mounted, setMounted] = React.useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard mounted flag to avoid hydration mismatch
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const hovering = mounted && mode === "hover" && hovered && !open;
  const expanded =
    mounted &&
    (open || (mode === "hover" && hovered && !open) || (mode === "expanded" && !isMobile));

  const handleModeChange = (next: SidebarMode) => {
    setMode(next);
    setOpen(next === "expanded");
  };

  const isDark = resolvedTheme === "dark";

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

        <Link href="/registrar/overview" className={styles.brand}>
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
            <div className={styles.accountGroup}>
              <div className={styles.accountGroupLabel}>
                <span>Font</span>
              </div>
              <DropdownMenuItem
                className={`${styles.accountItem} ${styles.accountSubItem}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setFont("inter");
                }}
              >
                <Type className={styles.accountIcon} />
                <span>Inter</span>
                {font === "inter" ? (
                  <span className={styles.accountCheck}>Active</span>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`${styles.accountItem} ${styles.accountSubItem}`}
                onSelect={(event) => {
                  event.preventDefault();
                  setFont("nunito");
                }}
              >
                <Type className={styles.accountIcon} />
                <span>Nunito</span>
                {font === "nunito" ? (
                  <span className={styles.accountCheck}>Active</span>
                ) : null}
              </DropdownMenuItem>
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
      <RegistrarSidebar
        expanded={expanded}
        hovering={hovering}
        onHoverChange={setHovered}
        mode={mode}
        onModeChange={handleModeChange}
      />
      <SidebarModeContext.Provider value={mode}>
        <div
          className={`${styles.shell} ${
            mounted && mode === "expanded" && !isMobile ? styles.shellExpanded : ""
          }`}
        >
          <main className={styles.main}>{children}</main>
        </div>
      </SidebarModeContext.Provider>
    </div>
  );
}

export default function RegistrarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider defaultOpen={false}>
      <RegistrarShell>{children}</RegistrarShell>
    </SidebarProvider>
  );
}
