"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/**
 * Topbar toggle for a desk's left rail. Desktop only — small screens use
 * the flattened tab bar, which never collapses. Same button, icons and
 * tooltip as the teacher desk's.
 */
export function SidebarToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
    >
      {collapsed ? (
        <PanelLeftOpen size={17} aria-hidden="true" />
      ) : (
        <PanelLeftClose size={17} aria-hidden="true" />
      )}
    </button>
  );
}
