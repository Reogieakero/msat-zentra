"use client";

/**
 * Vesper-style living orb: a torus of light built from thousands of points.
 * Mint-to-violet gradient, gentle breathing, and pointer-reactive tilt.
 * Drawn on a 2D canvas so it stays cheap and works without WebGL.
 */
import { useEffect, useRef } from "react";
import type { Palette } from "./palette";
import styles from "./LivingOrb.module.css";

const TAU = Math.PI * 2;

const PALETTES: Record<
  Palette,
  { a: [number, number, number]; b: [number, number, number]; hueStart: number; hueEnd: number }
> = {
  mint: { a: [126, 245, 208], b: [122, 104, 255], hueStart: 160, hueEnd: 272 },
  amber: { a: [255, 216, 138], b: [255, 159, 92], hueStart: 44, hueEnd: 12 },
};

type Point = { u: number; v: number; seed: number; dot: number };

export function LivingOrb({ palette }: { palette: Palette }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = canvas;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;
    const tones = PALETTES[palette];

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery.matches;

    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let running = true;

    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    // A torus sampled on a grid reads as rings of dots — the look of the
    // reference. Point count scales down on small screens to keep 60fps.
    const points: Point[] = [];
    const rebuild = (w: number) => {
      points.length = 0;
      const around = w < 720 ? 70 : 96;
      const across = w < 720 ? 30 : 42;
      for (let i = 0; i < around; i += 1) {
        for (let j = 0; j < across; j += 1) {
          points.push({
            u: (i / around) * TAU,
            v: (j / across) * TAU,
            seed: Math.random() * TAU,
            dot: 0.7 + Math.random() * 0.9,
          });
        }
      }
    };

    function resize() {
      const rect = surface.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      surface.width = Math.max(1, Math.floor(width * dpr));
      surface.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (points.length === 0) rebuild(width);
      if (reduced) draw(0.4);
    }

    function draw(t: number) {
      ctx.clearRect(0, 0, width, height);
      if (width === 0 || height === 0) return;

      const wide = width >= 900;
      const cx = wide ? width * 0.63 : width * 0.5;
      const cy = wide ? height * 0.48 : height * 0.56;
      const base = Math.min(width, height) * (wide ? 0.21 : 0.24);
      const breath = 1 + 0.035 * Math.sin(t * 0.9);

      // Soft halo behind the point cloud.
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 3.2);
      halo.addColorStop(0, `rgba(${tones.a[0]}, ${tones.a[1]}, ${tones.a[2]}, 0.13)`);
      halo.addColorStop(0.42, `rgba(${tones.b[0]}, ${tones.b[1]}, ${tones.b[2]}, 0.07)`);
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      const tilt = -1.08 + pointer.y * 0.24;
      const spin = t * 0.26 + pointer.x * 0.85;
      const roll = 0.16 + pointer.x * 0.18;
      const cosTilt = Math.cos(tilt);
      const sinTilt = Math.sin(tilt);
      const cosSpin = Math.cos(spin);
      const sinSpin = Math.sin(spin);
      const cosRoll = Math.cos(roll);
      const sinRoll = Math.sin(roll);
      const perspective = 3.2;

      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        const wobble =
          1 +
          0.045 * Math.sin(2 * p.u + t * 1.25 + p.seed) +
          0.03 * Math.sin(3 * p.v - t * 0.8);

        const ring = 1.3 * breath;
        const tube = 0.5 * wobble;
        const band = ring + tube * Math.cos(p.v);

        const x = band * Math.cos(p.u);
        const y = tube * Math.sin(p.v);
        const z = band * Math.sin(p.u);

        // Tilt around X, then spin around Y, then a small roll around Z.
        const y1 = y * cosTilt - z * sinTilt;
        const z1 = y * sinTilt + z * cosTilt;

        const x2 = x * cosSpin + z1 * sinSpin;
        const z2 = -x * sinSpin + z1 * cosSpin;

        const x3 = x2 * cosRoll - y1 * sinRoll;
        const y3 = x2 * sinRoll + y1 * cosRoll;

        const scale = (base * perspective) / (perspective - z2);
        const px = cx + x3 * scale;
        const py = cy + y3 * scale;

        if (px < -20 || px > width + 20 || py < -20 || py > height + 20) continue;

        const ringAngle = Math.atan2(y3, x3);
        const hue =
          tones.hueStart + ((ringAngle + Math.PI) / TAU) * (tones.hueEnd - tones.hueStart);
        const depth = Math.max(0, Math.min(1, (z2 + 1.5) / 3));
        const alpha = 0.2 + depth * 0.72;
        const size = p.dot * (0.62 + depth * 0.85);

        ctx.fillStyle = `hsla(${hue}, 94%, ${62 + depth * 12}%, ${alpha})`;
        ctx.fillRect(px, py, size, size);

        // A few brighter nodes give the cloud sparkle without per-point blur.
        if (p.dot > 1.45 && depth > 0.55) {
          ctx.fillStyle = `hsla(${hue}, 100%, 82%, ${alpha * 0.5})`;
          ctx.fillRect(px - size * 0.5, py - size * 0.5, size * 2.2, size * 2.2);
        }
      }

      ctx.globalCompositeOperation = "source-over";
    }

    const frame = (now: number) => {
      if (!running) return;
      if (last === 0) last = now;
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += delta;
      pointer.x += (pointer.targetX - pointer.x) * 0.055;
      pointer.y += (pointer.targetY - pointer.y) * 0.055;
      draw(elapsed);
      raf = window.requestAnimationFrame(frame);
    };

    const onPointer = (event: PointerEvent) => {
      const rect = surface.getBoundingClientRect();
      pointer.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const resetPointer = () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
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

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    if (reduced) {
      draw(0.4);
    } else {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.addEventListener("pointerleave", resetPointer);
      document.addEventListener("visibilitychange", onVisibility);
      raf = window.requestAnimationFrame(frame);
    }

    const onMotionChange = (event: MediaQueryListEvent) => {
      reduced = event.matches;
      if (reduced) {
        running = false;
        window.cancelAnimationFrame(raf);
        draw(0.4);
      } else {
        running = true;
        last = 0;
        raf = window.requestAnimationFrame(frame);
      }
    };
    motionQuery.addEventListener("change", onMotionChange);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", resetPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [palette]);

  return (
    <div className={styles.wrap} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
