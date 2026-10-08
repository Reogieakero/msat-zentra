"use client";

import {
  Brush,
  KeyRound,
  Palette,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export interface SettingsSectionLink {
  id: string;
  label: string;
  Icon: LucideIcon;
}

export function coordinatorSettingsSections(): SettingsSectionLink[] {
  return [
    { id: "section-profile", label: "Profile", Icon: UserRound },
    { id: "section-appearance", label: "Appearance", Icon: Palette },
    { id: "section-palette", label: "Palette", Icon: Brush },
    { id: "section-password", label: "Password", Icon: KeyRound },
  ];
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const smooth =
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}
