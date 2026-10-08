"use client";

import * as React from "react";
import { useTheme } from "@/components/providers";
import { CATEGORY_SHADES_DARK, CATEGORY_SHADES_LIGHT } from "./risk-dashboard-data";

type RGB = [number, number, number];

function parseRgb(value: string): RGB | null {
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

export function buildPrimaryScale(hex: string, isDark: boolean, count: number): string[] | null {
  const primary = parseHex(hex);
  if (!primary) return null;
  const surface = isDark ? DARK_SURFACE : LIGHT_SURFACE;
  const n = Math.max(count, 1);
  return Array.from({ length: n }, (_, i) =>
    mix(primary, surface, n === 1 ? 0 : (i / (n - 1)) * 0.82),
  );
}

export function usePrimaryScale(count: number, primaryHex?: string | null): string[] {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const n = Math.max(count, 1);
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
      setProbed((prev) =>
        prev !== null &&
        prev.length === next.length &&
        prev.every((v, i) => v === next[i])
          ? prev
          : next,
      );
    };
    const frame = window.requestAnimationFrame(measure);
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
