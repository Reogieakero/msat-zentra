"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";
import "./scroll-list.css";

interface ScrollListProps {
  /** Wrapper element. Docks render row lists (`ul`); dialogs/columns use `div`. */
  as?: "div" | "ul";
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  role?: string;
}

/**
 * Generic thin-amber scroll container for light and dark mode.
 * Layout (max height, gap, padding) stays with the caller via `className` —
 * this component only owns the scroll behavior and scrollbar styling.
 */
export function ScrollList({ as = "div", className, children, ariaLabel, role }: ScrollListProps) {
  const classes = cn(
    "zentra-scroll flex min-w-0 flex-col overflow-x-hidden overflow-y-auto",
    className,
  );
  if (as === "ul") {
    return (
      <ul className={classes} aria-label={ariaLabel} role={role}>
        {children}
      </ul>
    );
  }
  return (
    <div className={classes} aria-label={ariaLabel} role={role}>
      {children}
    </div>
  );
}
