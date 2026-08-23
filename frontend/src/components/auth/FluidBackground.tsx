"use client";

import * as React from "react";
import {
  startFluidBackground,
  defaultFluidConfig,
  type FluidConfig,
} from "@/lib/fluid/fluidBackground";

export type FluidHue = "green" | "blue" | "amber";

const HUE_MAP: Record<FluidHue, number> = {
  green: 0.42,
  blue: 0.62,
  amber: 0.09,
};

function buildFluidConfig(dark: boolean, hue: FluidHue): FluidConfig {
  return {
    ...defaultFluidConfig,
    TRANSPARENT: false,
    BACK_COLOR: dark ? { r: 10, g: 10, b: 10 } : { r: 250, g: 250, b: 249 },
    COLORFUL: false,
    RANDOM_COLORS: false,
    SPLAT_HUE: HUE_MAP[hue],
    SUNRAYS: false,
    SHADING: false,
    CURL: 6,
    DENSITY_DISSIPATION: 1.0,
    VELOCITY_DISSIPATION: 1.2,
    SPLAT_RADIUS: 0.35,
  };
}

export function FluidBackground({
  className,
  hue,
}: {
  className?: string;
  hue?: FluidHue;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Track the actual `.dark` class on <html> so the fluid background reacts to
  // theme switches reliably (the custom theme provider toggles that class).
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // When no explicit hue is provided, fall back to the user's persisted choice
  // so every fluid background across the app shares the same color.
  const [storedHue, setStoredHue] = React.useState<FluidHue>("green");
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem("zentra.fluidHue") as FluidHue | null;
      if (stored === "green" || stored === "blue" || stored === "amber") {
        setStoredHue(stored);
      }
    } catch {
      /* ignore unavailable storage */
    }
  }, []);

  const activeHue = hue ?? storedHue;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stop = startFluidBackground(
      canvas,
      buildFluidConfig(isDark, activeHue),
    );

    // The canvas sits behind the UI (pointer-events: none), so it never
    // receives its own mouse/touch events. Forward cursor movement from the
    // window so the fluid follows the user across the whole screen.
    const forwardMove = (clientX: number, clientY: number) => {
      canvas.dispatchEvent(
        new MouseEvent("mousemove", { clientX, clientY, bubbles: false }),
      );
    };
    const onMouseMove = (e: MouseEvent) => forwardMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) forwardMove(t.clientX, t.clientY);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      stop();
    };
  }, [isDark, activeHue]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className ?? "pointer-events-none absolute inset-0 h-full w-full"}
    />
  );
}


