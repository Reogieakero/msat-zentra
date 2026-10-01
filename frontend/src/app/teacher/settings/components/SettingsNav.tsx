"use client";

import {
  Brush,
  GraduationCap,
  KeyRound,
  Palette,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./settings-nav.module.css";

export interface SettingsSectionLink {
  id: string;
  label: string;
  Icon: LucideIcon;
}

export function settingsSections(masterTeacherEligible: boolean): SettingsSectionLink[] {
  const links: SettingsSectionLink[] = [
    { id: "section-profile", label: "Profile", Icon: UserRound },
    { id: "section-adviser", label: "Adviser", Icon: Users },
  ];
  if (masterTeacherEligible) {
    links.push({ id: "section-master-teacher", label: "Master Teacher", Icon: GraduationCap });
  }
  links.push(
    { id: "section-appearance", label: "Appearance", Icon: Palette },
    { id: "section-palette", label: "Palette", Icon: Brush },
    { id: "section-password", label: "Password", Icon: KeyRound },
  );
  return links;
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const smooth =
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

interface SettingsNavProps {
  links: SettingsSectionLink[];
  activeId: string;
  onSelect: (id: string) => void;
}

/* Branched icon dock (reactbits branched-menu language): hovering an icon
   fans a curved branch with its label out to the side; the active item
   keeps its branch open. Staggered spring-ish motion, CSS only. */
export function BranchedNav({ links, activeId, onSelect }: SettingsNavProps) {
  return (
    <nav aria-label="Settings sections" className={styles.dock}>
      {links.map((l, i) => {
        const active = l.id === activeId;
        const { Icon } = l;
        return (
          <div key={l.id} className={styles.dockItem}>
            <button
              type="button"
              onClick={() => onSelect(l.id)}
              aria-current={active || undefined}
              aria-label={l.label}
              title={l.label}
              className={cn(styles.dockButton, active && styles.dockButtonActive)}
            >
              <Icon className={styles.dockIcon} aria-hidden="true" />
            </button>
            <span
              className={cn(styles.branch, active && styles.branchOpen)}
              style={{ transitionDelay: `${i * 35}ms` }}
              aria-hidden={active ? undefined : "true"}
            >
              <svg
                className={styles.branchCurve}
                width="26"
                height="44"
                viewBox="0 0 26 44"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M1 22 C 10 22, 12 22, 25 22"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="25" cy="22" r="2.5" fill="currentColor" />
              </svg>
              <button
                type="button"
                tabIndex={active ? 0 : -1}
                onClick={() => onSelect(l.id)}
                className={cn(styles.branchLabel, active && styles.branchLabelActive)}
              >
                {l.label}
              </button>
            </span>
          </div>
        );
      })}
    </nav>
  );
}
