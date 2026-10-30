"use client";

import * as React from "react";

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Reveals a live KPI by counting it up from its previous value, easing out.
 *
 * The overview boards mount with the final figure the moment the query
 * resolves, which reads as a pop. Ticking the number over ~0.9s makes the
 * board feel like a live instrument instead. Reduced-motion users (and any
 * environment without rAF) jump straight to the target.
 */
export function useCountUp(target: number, duration = 900): number {
  const safeTarget = Number.isFinite(target) ? target : 0;
  // Start at zero so the first committed frame is the count's starting point —
  // the effect below ticks it up to the live figure.
  const [value, setValue] = React.useState(0);
  const fromRef = React.useRef(0);

  React.useEffect(() => {
    const from = fromRef.current;
    fromRef.current = safeTarget;

    if (from === safeTarget || reducedMotion()) {
      setValue(safeTarget);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out-cubic — fast off the line, settles precisely on the figure.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (safeTarget - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [safeTarget, duration]);

  return value;
}
