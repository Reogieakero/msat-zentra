"use client";

import * as React from "react";
import Link from "next/link";
import { StaffSidebar, type SidebarMode } from "@/components/staff-sidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { PanelLeftIcon } from "lucide-react";
import styles from "./principal.module.css";

function PrincipalShell({ children }: { children: React.ReactNode }) {
  const { open, setOpen, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const [hovered, setHovered] = React.useState(false);
  const [mode, setMode] = React.useState<SidebarMode>("hover");

  const expanded = open || (mode === "hover" && hovered);
  const hoverWidth = mode === "hover" && hovered && !open;

  const handleModeChange = (next: SidebarMode) => {
    setMode(next);
    setOpen(next === "expanded");
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.topbar}>
        <Link href="/principal/overview" className={styles.brand}>
          <span className={styles.brandMark}>Z</span>
        </Link>
        <button
          type="button"
          className={styles.trigger}
          aria-label="Toggle sidebar"
          onClick={() => (isMobile ? setOpenMobile(true) : toggleSidebar())}
        >
          <PanelLeftIcon className={styles.triggerIcon} />
        </button>
        <span className={styles.title}>Principal Workspace</span>
      </header>
      <StaffSidebar
        expanded={expanded}
        hoverWidth={hoverWidth}
        onHoverChange={setHovered}
        mode={mode}
        onModeChange={handleModeChange}
      />
      <div
        className={`${styles.shell} ${
          expanded && !isMobile
            ? hoverWidth
              ? styles.shellHoverWidth
              : styles.shellExpanded
            : ""
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
      <PrincipalShell>{children}</PrincipalShell>
    </SidebarProvider>
  );
}

