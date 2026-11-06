"use client";

import * as React from "react";

/**
 * Eases a number from 0 up to `target` over `duration` ms (ease-out cubic).
 *
 * Used for chart centre values and headline counters so the figure "lands"
 * together with the arc/bars drawing in. Honours `prefers-reduced-motion` by
 * jumping straight to the final value on the first frame.
 */
export function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined" || !Number.isFinite(target) || target <= 0) {
      // Nothing to count; one frame keeps the update out of the effect body.
      const frame = requestAnimationFrame(() => setValue(Math.max(0, target || 0)));
      return () => cancelAnimationFrame(frame);
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const span = reduce || duration <= 0 ? 0 : duration;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = span <= 0 ? 1 : Math.min(1, (now - start) / span);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(progress >= 1 ? target : Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
