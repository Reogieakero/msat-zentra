"use client";

import * as React from "react";
import styles from "./fire-particles.module.css";

interface FireParticlesProps {
  count?: number;
  className?: string;
}

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
