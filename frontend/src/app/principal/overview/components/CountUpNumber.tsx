"use client";

import { useCountUp } from "./use-count-up";

/**
 * A number that ticks up to its live value. Thin wrapper so components can
 * animate figures inside `.map()` without breaking the hooks rule.
 */
export function CountUpNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const shown = useCountUp(value);
  return <span className={className}>{shown}</span>;
}
