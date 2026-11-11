import { ROLES } from "@/lib/auth/roles";

/**
 * Marker colours for the administrator presence globe, one per role.
 * Green/emerald tones are intentionally avoided because the landmass itself is
 * green. Shared by the three.js scene and the on-screen legend.
 */
export const ROLE_COLORS: Record<string, string> = {
  student: "#60a5fa", // blue
  parent: "#a78bfa", // violet
  subject_teacher: "#fbbf24", // amber
  adviser: "#fb923c", // orange
  nurse: "#f472b6", // pink
  adm_coordinator: "#f87171", // red
  guidance_counselor: "#22d3ee", // cyan
  record_keeper: "#e879f9", // fuchsia
  registrar: "#818cf8", // indigo
  principal: "#f43f5e", // rose
  admin: "#2dd4bf", // teal
};

export const DEFAULT_ROLE_COLOR = "#94a3b8";

export function roleColor(role: string): string {
  return ROLE_COLORS[role] ?? DEFAULT_ROLE_COLOR;
}

/** Legend order — mirrors the canonical role list. */
export const LEGEND_ROLES: readonly string[] = ROLES;
