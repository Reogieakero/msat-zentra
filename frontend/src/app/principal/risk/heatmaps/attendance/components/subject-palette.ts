// Series colors derived from the viewer's own workspace palette (the same
// primary/secondary hexes PrincipalPaletteGate paints onto --primary /
// --secondary). No color library — small hex/HSL helpers only.
//
// - primary + secondary  → interpolate across the primary→secondary ramp.
// - primary only         → golden-angle hue rotation from the primary hue.
// - neither set          → fixed categorical fallback ramp.
// Lightness is clamped per theme so every series stays readable on the card
// in both light and dark mode.

interface HSL {
  h: number;
  s: number;
  l: number;
}

function normalizeHex(hex: string): string | null {
  const c = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(c)) return `#${c.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(c)) {
    return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`.toLowerCase();
  }
  return null;
}

function hexToHsl(hex: string): HSL | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(100, Math.max(0, s)) / 100;
  const ll = Math.min(100, Math.max(0, l)) / 100;
  const k = (n: number) => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) =>
    ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

//Readable lightness band for thin chart lines on the card surface.
function bandLightness(l: number, dark: boolean): number {
  return dark
    ? Math.min(72, Math.max(60, l))
    : Math.min(55, Math.max(38, l));
}

function clampSat(s: number): number {
  // Near-grays get a floor so rotated hues stay distinguishable.
  return Math.min(85, Math.max(55, s));
}

// Fixed categorical fallback (brand-agnostic) when no palette is saved.
const FALLBACK_HUES = [217, 160, 36, 0, 280, 330, 190, 96, 25, 262, 140, 310];

function shortestLerp(a: number, b: number, t: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return a + d * t;
}

export function primarySeriesColors({
  primary,
  secondary,
  count,
  dark,
}: {
  primary: string | null | undefined;
  secondary: string | null | undefined;
  count: number;
  dark: boolean;
}): string[] {
  if (count <= 0) return [];
  const p = primary ? hexToHsl(primary) : null;
  const s = secondary ? hexToHsl(secondary) : null;

  if (p && s) {
    return Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0 : i / (count - 1);
      return hslToHex(
        shortestLerp(p.h, s.h, t),
        clampSat(p.s + (s.s - p.s) * t),
        bandLightness(p.l + (s.l - p.l) * t, dark)
      );
    });
  }

  if (p) {
    if (count === 1) {
      return [hslToHex(p.h, clampSat(p.s), bandLightness(p.l, dark))];
    }
    // Golden-angle steps so neighbors never land on adjacent hues.
    return Array.from({ length: count }, (_, i) =>
      hslToHex(
        p.h + i * 137.5,
        clampSat(p.s),
        bandLightness(p.l, dark)
      )
    );
  }

  return Array.from({ length: count }, (_, i) => {
    const h = FALLBACK_HUES[i % FALLBACK_HUES.length]!;
    const shade = Math.floor(i / FALLBACK_HUES.length) % 2 === 0 ? 0 : 12;
    return hslToHex(h, 70, dark ? 66 + shade : 46 - shade);
  });
}
