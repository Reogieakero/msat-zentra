"use client";

/**
 * Global scroll object: one coherent particle body, fixed behind the page.
 * Instead of staying a donut, it morphs between shapes that mirror the system:
 * a torus (hero), a laptop (records), a radar (risk engine), a document (SF10),
 * a chart (reports), and a shield (confidentiality). Morphing follows scroll,
 * holding each silhouette briefly so it stays readable before it turns.
 */
import { useEffect, useRef } from "react";
import type { Palette } from "./palette";
import styles from "./ScrollField.module.css";

const TAU = Math.PI * 2;
const COUNT = 3600;

const PALETTES: Record<
  Palette,
  { a: [number, number, number]; b: [number, number, number]; hueStart: number; hueEnd: number }
> = {
  mint: { a: [126, 245, 208], b: [122, 104, 255], hueStart: 160, hueEnd: 272 },
  amber: { a: [255, 216, 138], b: [255, 159, 92], hueStart: 44, hueEnd: 12 },
};

type Rand = () => number;

function makeRandom(seed: number): Rand {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ring body with a fat tube — the shape that opens the page. */
function torusShape(rand: Rand): Float32Array {
  const out = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i += 1) {
    const u = rand() * TAU;
    const v = rand() * TAU;
    const band = 1.12 + 0.48 * Math.cos(v);
    out[i * 3] = band * Math.cos(u);
    out[i * 3 + 1] = band * Math.sin(u);
    out[i * 3 + 2] = 0.48 * Math.sin(v);
  }
  return out;
}

/** Open laptop: screen slab on top, wider keyboard deck below. */
function laptopShape(rand: Rand): Float32Array {
  const out = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i += 1) {
    if (rand() < 0.6) {
      // Screen: mostly outline so the silhouette reads.
      const halfW = 0.96;
      const bottom = 0.2;
      const top = 1.34;
      const edge = rand();
      let x: number;
      let y: number;
      if (edge < 0.5) {
        x = (rand() < 0.5 ? -1 : 1) * halfW;
        y = bottom + rand() * (top - bottom);
      } else {
        x = (rand() * 2 - 1) * halfW;
        y = rand() < 0.62 ? top : bottom;
      }
      out[i * 3] = x;
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = 0.06;
    } else {
      // Keyboard deck: outline, plus rows of keys.
      const t = rand();
      const halfW = 0.98 + t * 0.3;
      if (rand() < 0.55) {
        const along = rand();
        if (rand() < 0.5) {
          out[i * 3] = (rand() < 0.5 ? -1 : 1) * halfW;
          out[i * 3 + 1] = 0.06 - along * 0.68;
        } else {
          out[i * 3] = (rand() * 2 - 1) * halfW;
          out[i * 3 + 1] = rand() < 0.5 ? 0.06 : -0.62;
        }
      } else {
        const row = Math.floor(rand() * 4);
        out[i * 3] = (rand() * 2 - 1) * (0.82 + row * 0.06);
        out[i * 3 + 1] = -0.04 - row * 0.16;
      }
      out[i * 3 + 2] = 0.12 + t * 0.18;
    }
  }
  return out;
}

/** Risk radar: concentric range rings, a sweep arm, and blips. */
function radarShape(rand: Rand): Float32Array {
  const out = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i += 1) {
    const roll = rand();
    let x = 0;
    let y = 0;
    let z = (rand() - 0.5) * 0.08;

    if (roll < 0.5) {
      // Range rings.
      const ring = 0.34 + Math.floor(rand() * 4) * 0.3;
      const angle = rand() * TAU;
      x = Math.cos(angle) * (ring + (rand() - 0.5) * 0.02);
      y = Math.sin(angle) * (ring + (rand() - 0.5) * 0.02);
    } else if (roll < 0.62) {
      // Sweep arm: a narrow wedge from the centre.
      const angle = -TAU / 4 + (rand() - 0.5) * 0.09;
      const radius = Math.sqrt(rand()) * 1.22;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      z = (rand() - 0.5) * 0.05;
    } else if (roll < 0.68) {
      // Cross hairs.
      const radius = rand() * 1.24;
      if (rand() < 0.5) {
        x = radius;
        y = (rand() - 0.5) * 0.03;
      } else {
        x = (rand() - 0.5) * 0.03;
        y = radius;
      }
    } else {
      // Risk blips inside the disc.
      const radius = Math.sqrt(rand()) * 0.9;
      const angle = rand() * TAU;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      z = (rand() - 0.5) * 0.22;
    }

    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

/** SF10 record: a page edge, a header block, text rules, and a seal. */
function documentShape(rand: Rand): Float32Array {
  const out = new Float32Array(COUNT * 3);
  const halfW = 0.72;
  const top = 1.16;
  const bottom = -1.16;
  for (let i = 0; i < COUNT; i += 1) {
    const roll = rand();

    if (roll < 0.3) {
      // Impression seal, bottom right.
      const radius = 0.16 + rand() * 0.2;
      const angle = rand() * TAU;
      out[i * 3] = 0.34 + Math.cos(angle) * radius;
      out[i * 3 + 1] = bottom + 0.36 + Math.sin(angle) * radius;
      out[i * 3 + 2] = 0.04;
    } else if (roll < 0.42) {
      // Page outline.
      const edge = rand();
      let x: number;
      let y: number;
      if (edge < 0.5) {
        x = (rand() < 0.5 ? -1 : 1) * halfW;
        y = bottom + rand() * (top - bottom);
      } else {
        x = (rand() * 2 - 1) * halfW;
        y = rand() < 0.5 ? top : bottom;
      }
      out[i * 3] = x;
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = 0.02;
    } else {
      // Header bar and text rules.
      const line = Math.floor(rand() * 9);
      if (line === 0) {
        const x = (rand() * 2 - 1) * halfW * 0.62;
        out[i * 3] = x;
        out[i * 3 + 1] = top - 0.2 + rand() * 0.1;
      } else {
        const shortLine = line > 6;
        const width = shortLine ? halfW * 0.95 : halfW * 1.32;
        out[i * 3] = (rand() - 0.5) * width + (shortLine ? -halfW * 0.1 : 0);
        out[i * 3 + 1] = top - 0.24 - line * 0.22 + (rand() - 0.5) * 0.02;
      }
      out[i * 3 + 2] = 0.02;
    }
  }
  return out;
}

/** Reports: axis lines, outlined bars of different heights. */
function chartShape(rand: Rand): Float32Array {
  const out = new Float32Array(COUNT * 3);
  const heights = [0.54, 0.92, 1.22, 0.72, 1.06, 1.4];
  const barWidth = 0.26;
  const gap = 0.12;
  const base = -1.0;
  const start = -((barWidth + gap) * heights.length - gap) / 2;
  for (let i = 0; i < COUNT; i += 1) {
    const roll = rand();
    if (roll < 0.14) {
      // Axes.
      if (rand() < 0.7) {
        out[i * 3] = (rand() - 0.5) * 2.42;
        out[i * 3 + 1] = base;
      } else {
        out[i * 3] = -1.2;
        out[i * 3 + 1] = base + rand() * 2.5;
      }
      out[i * 3 + 2] = 0.02;
      continue;
    }

    const bar = Math.floor(rand() * heights.length);
    const left = start + bar * (barWidth + gap);
    const top = base + heights[bar];
    if (rand() < 0.7) {
      // Bar outline: sides and cap.
      if (rand() < 0.55) {
        out[i * 3] = left + (rand() < 0.5 ? 0 : barWidth);
        out[i * 3 + 1] = base + rand() * heights[bar];
      } else {
        out[i * 3] = left + rand() * barWidth;
        out[i * 3 + 1] = top + (rand() - 0.5) * 0.02;
      }
    } else {
      out[i * 3] = left + rand() * barWidth;
      out[i * 3 + 1] = base + rand() * heights[bar];
    }
    out[i * 3 + 2] = 0.06 + rand() * 0.08;
  }
  return out;
}

/** Confidentiality: a shield outline with an inner check. */
function shieldShape(rand: Rand): Float32Array {
  const out = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i += 1) {
    const y = -1.2 + rand() * 2.3;
    const half = 0.74 * Math.sqrt(Math.max(0, (y + 1.2) / 2.3));
    if (rand() < 0.68) {
      // Outline.
      const x = (rand() < 0.5 ? -1 : 1) * half;
      out[i * 3] = x;
      out[i * 3 + 1] = y;
    } else {
      // Fill.
      out[i * 3] = (rand() * 2 - 1) * half * 0.88;
      out[i * 3 + 1] = y;
    }
    out[i * 3 + 2] = (rand() - 0.5) * 0.1;
  }
  return out;
}

const SHAPES: Float32Array[] = [
  torusShape(makeRandom(101)),
  laptopShape(makeRandom(202)),
  radarShape(makeRandom(303)),
  documentShape(makeRandom(404)),
  chartShape(makeRandom(505)),
  shieldShape(makeRandom(606)),
].map(normalize);

/** Centre each silhouette and scale it to the same footprint so morphs stay stable. */
function normalize(shape: Float32Array): Float32Array {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxR = 0;
  for (let i = 0; i < COUNT; i += 1) {
    const idx = i * 3;
    const x = shape[idx];
    const y = shape[idx + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const offsetX = (minX + maxX) * 0.5;
  const offsetY = (minY + maxY) * 0.5;
  const halfX = (maxX - minX) * 0.5 || 1;
  const halfY = (maxY - minY) * 0.5 || 1;
  for (let i = 0; i < COUNT; i += 1) {
    const idx = i * 3;
    const x = (shape[idx] - offsetX) / halfX;
    const y = (shape[idx + 1] - offsetY) / halfY;
    maxR = Math.max(maxR, Math.hypot(x, y));
  }
  const scale = 1.05 / (maxR || 1);
  for (let i = 0; i < COUNT; i += 1) {
    const idx = i * 3;
    shape[idx] = (shape[idx] - offsetX) / halfX * scale;
    shape[idx + 1] = (shape[idx + 1] - offsetY) / halfY * scale;
    shape[idx + 2] *= scale;
  }
  return shape;
}

function smoothstep(value: number) {
  const v = Math.max(0, Math.min(1, value));
  return v * v * (3 - 2 * v);
}

type Align = "right" | "topRight";

function drawObject(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  progress: number,
  palette: Palette,
  align: Align
) {
  const tones = PALETTES[palette];
  const wide = width >= 900;
  const topRight = align === "topRight";
  const cx = topRight
    ? wide
      ? width * 0.82
      : width * 0.74
    : wide
      ? width * 0.71
      : width * 0.5;
  const cy = topRight
    ? wide
      ? height * 0.28
      : height * 0.3
    : wide
      ? height * 0.5
      : height * 0.53;
  const base = Math.min(width, height) * (topRight ? (wide ? 0.22 : 0.26) : wide ? 0.29 : 0.34);

  const morph = progress * (SHAPES.length - 1);
  const from = Math.min(SHAPES.length - 1, Math.floor(morph));
  const to = Math.min(SHAPES.length - 1, from + 1);
  // Hold each silhouette for most of its band, then morph quickly at the seam.
  const blend = smoothstep((morph - from - 0.78) / 0.22);
  const shapeA = SHAPES[from];
  const shapeB = SHAPES[to];
  // Ease the sculpture down while it is between shapes, so the in-between
  // frames dissolve instead of reading as a shapeless cloud.
  const morphDip = 1 - 0.45 * Math.sin(Math.PI * blend);

  ctx.clearRect(0, 0, width, height);

  // Soft live glow under the point cloud.
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 1.9);
  halo.addColorStop(0, `rgba(${tones.a[0]}, ${tones.a[1]}, ${tones.a[2]}, ${0.15 * morphDip})`);
  halo.addColorStop(0.42, `rgba(${tones.b[0]}, ${tones.b[1]}, ${tones.b[2]}, ${0.08 * morphDip})`);
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(cx - base * 1.9, cy - base * 1.9, base * 3.8, base * 3.8);

  const tilt = -0.12 + Math.sin(t * 0.38) * 0.07;
  // Keep the spin small: a large Y-rotation would turn the flat shapes edge-on.
  const spin = Math.sin(t * 0.5) * 0.26;
  // Slow orbital drift so the cloud keeps breathing even when the page is idle.
  const driftX = Math.sin(t * 0.24) * base * 0.05;
  const driftY = Math.cos(t * 0.19) * base * 0.045;
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);
  const cosSpin = Math.cos(spin);
  const sinSpin = Math.sin(spin);
  const perspective = 3.4;

  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < COUNT; i += 1) {
    const idx = i * 3;
    const x = shapeA[idx] * (1 - blend) + shapeB[idx] * blend;
    const y = shapeA[idx + 1] * (1 - blend) + shapeB[idx + 1] * blend;
    const z = shapeA[idx + 2] * (1 - blend) + shapeB[idx + 2] * blend;

    const y1 = y * cosTilt - z * sinTilt;
    const z1 = y * sinTilt + z * cosTilt;

    const x2 = x * cosSpin + z1 * sinSpin;
    const z2 = -x * sinSpin + z1 * cosSpin;

    const scale = (base * perspective) / (perspective - z2);
    const px = cx + driftX + x2 * scale;
    // Shapes are authored y-up, so flip into canvas coordinates.
    const py = cy + driftY - y1 * scale;

    if (px < -40 || px > width + 40 || py < -40 || py > height + 40) continue;

    const radial = (Math.atan2(y1, x2) + Math.PI) / TAU;
    const hue = tones.hueStart + radial * (tones.hueEnd - tones.hueStart);
    const depth = Math.max(0, Math.min(1, (z2 + 1.4) / 2.8));
    const alpha = (0.2 + depth * 0.6) * morphDip;
    const size = 0.9 + depth * 1.5;

    ctx.fillStyle = `hsla(${hue}, 94%, ${63 + depth * 12}%, ${alpha})`;
    ctx.fillRect(px, py, size, size);
  }

  ctx.globalCompositeOperation = "source-over";
}

export function ScrollField({
  palette,
  autoCycle = false,
  align = "right",
}: {
  palette: Palette;
  autoCycle?: boolean;
  /** Where the sculpture sits in the viewport. */
  align?: Align;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fillRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = canvas;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;

    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reduceQuery.matches;

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;
    let last = 0;
    let elapsed = 0;
    let progress = 0;
    let targetProgress = 0;

    const readProgress = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      return Math.max(0, Math.min(1, window.scrollY / max));
    };

    function resize() {
      const rect = surface.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      surface.width = Math.max(1, Math.floor(width * dpr));
      surface.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) drawObject(ctx, width, height, 0.4, progress, palette, align);
    }

    const updateProgress = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const value = Math.max(0, Math.min(1, window.scrollY / max));
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleX(${value})`;
      }
    };

    function frame(now: number) {
      if (!running) return;
      if (last === 0) last = now;
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += delta;
      if (autoCycle) {
        // Idle pages have no scroll to drive the morph, so walk the shapes on
        // a timer instead — one full loop every ~36s.
        progress = (elapsed * 0.028) % 1;
      } else {
        progress += (targetProgress - progress) * 0.06;
      }
      drawObject(ctx, width, height, elapsed, progress, palette, align);
      raf = window.requestAnimationFrame(frame);
    }

    const onScroll = () => {
      targetProgress = readProgress();
      updateProgress();
      if (reduced) {
        progress = targetProgress;
        drawObject(ctx, width, height, 0.4, progress, palette, align);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(raf);
      } else if (!reduced) {
        running = true;
        last = 0;
        raf = window.requestAnimationFrame(frame);
      }
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reduced = event.matches;
      if (reduced) {
        running = false;
        window.cancelAnimationFrame(raf);
        drawObject(ctx, width, height, 0.4, progress, palette, align);
      } else {
        running = true;
        last = 0;
        raf = window.requestAnimationFrame(frame);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reduceQuery.addEventListener("change", onMotionChange);

    if (reduced) {
      drawObject(ctx, width, height, 0.4, 0, palette, align);
    } else {
      raf = window.requestAnimationFrame(frame);
    }

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceQuery.removeEventListener("change", onMotionChange);
    };
  }, [palette, autoCycle, align]);

  return (
    <>
      <div className={styles.field} data-align={align} aria-hidden="true">
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>
      <div className={styles.veil} aria-hidden="true" />
      <div className={styles.progress} aria-hidden="true">
        <span ref={fillRef} className={styles.progressFill} />
      </div>
    </>
  );
}
