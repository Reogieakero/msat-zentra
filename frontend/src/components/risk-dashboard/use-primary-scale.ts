"use client";

import * as React from "react";
import { useTheme } from "@/components/providers";
import { CATEGORY_SHADES_DARK, CATEGORY_SHADES_LIGHT } from "./risk-dashboard-data";

type RGB = [number, number, number];

function parseRgb(value: string): RGB | null {
  // Handles legacy commas, modern space syntax, and slash alpha
  // ("rgb(59, 130, 246)", "rgb(59 130 246)", "rgb(59 130 246 / 1)").
  // Non-sRGB spaces (oklch/…) don't match and fall back to static steps.
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1]
    .split(/[\s,/]+/)
    .filter((p) => p.length > 0)
    .slice(0, 3)
    .map((p) => parseFloat(p));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0], parts[1], parts[2]];
}

/* Resolved runtime value of a CSS var (follows user-recolored palettes).
   Probes through a throwaway node because custom-property values read
   off :root come back unresolved. */
function probeVar(name: string): string | null {
  try {
    const probe = document.createElement("span");
    probe.style.cssText = `position:absolute;visibility:hidden;color:var(${name});`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value || null;
  } catch {
    return null;
  }
}

function mix(a: RGB, b: RGB, t: number): string {
  const c = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}

/* Stored settings hex ("#3b82f6", short form tolerated) → RGB. */
function parseHex(hex: string): RGB | null {
  const h = hex.trim().replace(/^#/, "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

const LIGHT_SURFACE: RGB = [255, 255, 255];
const DARK_SURFACE: RGB = [46, 46, 46];

/**
 * Deterministic primary scale from a settings hex — darkest (pure primary)
 * first, stepping toward the card surface. No DOM involved, so it can never
 * go stale; returns null when the hex is unusable.
 */
export function buildPrimaryScale(hex: string, isDark: boolean, count: number): string[] | null {
  const primary = parseHex(hex);
  if (!primary) return null;
  const surface = isDark ? DARK_SURFACE : LIGHT_SURFACE;
  const n = Math.max(count, 1);
  return Array.from({ length: n }, (_, i) =>
    mix(primary, surface, n === 1 ? 0 : (i / (n - 1)) * 0.82),
  );
}

/**
 * Primary-ink scale with `count` steps, darkest first. When `primaryHex`
 * (the desk's saved settings color) is provided the scale builds straight
 * from it — deterministic, no timing involved. Otherwise it resolves live
 * from the runtime `--primary` toward the card surface, so SVG fills follow
 * user-recolored palettes (SVG attributes can't resolve CSS vars). Falls
 * back to the static per-theme ink steps on first paint.
 */
export function usePrimaryScale(count: number, primaryHex?: string | null): string[] {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const n = Math.max(count, 1);
  // A settings hex wins outright — pure render-time derivation, no timing
  // involved and no effect needed.
  const direct = primaryHex ? buildPrimaryScale(primaryHex, isDark, n) : null;
  const [probed, setProbed] = React.useState<string[] | null>(null);
  const hasDirect = direct !== null;
  React.useEffect(() => {
    if (hasDirect) return;
    const measure = () => {
      const primary = parseRgb(probeVar("--primary") ?? "");
      const surface = parseRgb(probeVar("--card") ?? "");
      if (!primary || !surface) return;
      const next = Array.from({ length: n }, (_, i) =>
        mix(primary, surface, n === 1 ? 0 : (i / (n - 1)) * 0.82),
      );
      // The saved settings palette lands after first paint (async fetch) —
      // adopt it when it arrives, but skip identical scales.
      setProbed((prev) =>
        prev !== null &&
        prev.length === next.length &&
        prev.every((v, i) => v === next[i])
          ? prev
          : next,
      );
    };
    // Measure after paint — async so the effect itself never sets state
    // synchronously.
    const frame = window.requestAnimationFrame(measure);
    // The palette gate paints :root vars whenever settings resolve or the
    // user recolors — re-measure then so charts track it live.
    const observer = new MutationObserver(measure);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [n, resolvedTheme, hasDirect]);
  return (
    direct ??
    probed ??
    (isDark ? CATEGORY_SHADES_DARK : CATEGORY_SHADES_LIGHT).slice(0, n)
  );
}
