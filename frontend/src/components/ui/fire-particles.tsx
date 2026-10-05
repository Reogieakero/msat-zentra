"use client";

import * as React from "react";
import styles from "./fire-particles.module.css";

interface FireParticlesProps {
  /** Number of ember dots. CardModal-scale overlays use ~48; small
   *  banner cards use ~12 so text stays readable. */
  count?: number;
  className?: string;
}

/* Fire particles rising bottom → top, tinted by the user's primary
 * palette. Deterministic per index (same formula as the original
 * CardModal particles) and stable per mount so they never reshuffle on
 * parent renders. Rise distance inherits --p-rise from the wrapper
 * (fullscreen overlays leave the -100vh default; small cards set a
 * pixel value like -320px). Hidden under prefers-reduced-motion. */
export function FireParticles({ count = 12, className }: FireParticlesProps) {
  const particles = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 37 + 11) % 100}%`,
        size: 2 + ((i * 5) % 6),
        duration: `${5 + ((i * 7) % 8)}s`,
        delay: `${-((i * 13) % 12)}s`,
      })),
    [count],
  );

  return (
    <span
      className={className ? `${styles.particles} ${className}` : styles.particles}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className={styles.particle}
          style={
            {
              left: p.left,
              "--p-size": `${p.size}px`,
              "--p-duration": p.duration,
              "--p-delay": p.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
