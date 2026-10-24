"use client";

import * as React from "react";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./SidebarIconRail.module.css";

export type SidebarNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export type SidebarNavGroup = {
  label: string;
  items: SidebarNavItem[];
};

/**
 * Icon-only collapsed rail shared by every desk's left sidebar (teacher,
 * principal, nurse, guidance, coordinator, registrar, record keeper).
 * Renders the exact same icon buttons and hover tooltips as the teacher
 * desk's collapsed rail. The open/closed state lives in the desk layout.
 */
export function SidebarIconRail({
  groups,
  ariaLabel,
  activeHref,
}: {
  groups: SidebarNavGroup[];
  ariaLabel: string;
  activeHref: string;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <ul className={styles.collapsedList} aria-label={ariaLabel}>
        {groups.map((group, gi) => (
          <li key={group.label} className={styles.collapsedGroup}>
            {gi > 0 ? <span className={styles.collapsedDivider} aria-hidden="true" /> : null}
            {group.items.map((t) => {
              const active = t.href === activeHref;
              return (
                <Tooltip key={t.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={t.href}
                      className={`${styles.iconBtn} ${active ? styles.iconBtnActive : ""}`}
                      aria-current={active ? "page" : undefined}
                      aria-label={`${t.title} (${group.label})`}
                    >
                      <t.icon size={17} strokeWidth={1.8} aria-hidden="true" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    <span className="font-medium">{t.title}</span>
                    <span className="opacity-60">{group.label}</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </li>
        ))}
      </ul>
    </TooltipProvider>
  );
}
