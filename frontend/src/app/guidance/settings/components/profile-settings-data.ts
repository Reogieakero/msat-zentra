"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";

export interface GuidanceProfileSettings {
  fullName: string;
  photoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

/** Guidance-scoped key — palettes must never leak across counselor sessions. */
export function guidanceProfileSettingsKey(counselorId: string | null | undefined) {
  return ["guidance-profile-settings", counselorId ?? "anon"] as const;
}

export async function fetchGuidanceProfileSettings(): Promise<GuidanceProfileSettings> {
  const { data } = await apiClient.get<GuidanceProfileSettings>(
    "/api/guidance/settings/profile",
  );
  return data;
}

const SETTINGS_STALE_MS = 30_000;
const SETTINGS_GC_MS = 5 * 60_000;

export function useGuidanceProfileSettings() {
  const session = useSession();
  const counselorId = session?.sub ?? null;
  return useQuery({
    queryKey: guidanceProfileSettingsKey(counselorId),
    queryFn: fetchGuidanceProfileSettings,
    enabled: !!counselorId,
    staleTime: SETTINGS_STALE_MS,
    gcTime: SETTINGS_GC_MS,
  });
}

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Readable foreground for a brand background (dark text on light colors). */
export function contrastForeground(hex: string): string {
  return luminance(hex) > 0.4 ? "#18181b" : "#fafafa";
}

/** Paint the workspace brand vars. Nulls fall back to the theme default. */
export function applyPalette(primary: string | null, secondary: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (primary) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", contrastForeground(primary));
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--primary-foreground");
  }
  if (secondary) {
    root.style.setProperty("--secondary", secondary);
    root.style.setProperty("--secondary-foreground", contrastForeground(secondary));
  } else {
    root.style.removeProperty("--secondary");
    root.style.removeProperty("--secondary-foreground");
  }
}

/** Mount once per desk shell: the saved palette paints every page, and a
 *  counselor without one (or after logout cache clear) resets to the theme. */
export function GuidancePaletteGate() {
  const { data } = useGuidanceProfileSettings();
  const signature = data
    ? `${data.primaryColor ?? ""}|${data.secondaryColor ?? ""}`
    : "none";
  React.useEffect(() => {
    if (!data || (!data.primaryColor && !data.secondaryColor)) {
      applyPalette(null, null);
      return;
    }
    applyPalette(data.primaryColor, data.secondaryColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return null;
}
