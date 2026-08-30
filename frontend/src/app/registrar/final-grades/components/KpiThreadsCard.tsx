"use client";

import * as React from "react";
import WebThreads from "@/components/ui/web-threads/WebThreads";
import styles from "./KpiThreadsCard.module.css";

type Props = {
  label: string;
  value: number | string;
  hint?: string;
};

export function KpiThreadsCard({ label, value, hint }: Props) {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className={styles.card}>
      <div className={styles.bg}>
        <WebThreads
          color1="#2eea2e"
          color2="#2cef39"
          color3="#0b8f1f"
          speed={0.2}
          threadCount={6}
          frequency={5}
          spread={0.18}
          taper={1}
          position={0.5}
          fanMode="center"
          glow={0.018}
          falloff={0.6}
          thickness={1.1}
          brightness={isDark ? 0.9 : 0.82}
          opacity={1}
          mirror
          shimmer={false}
          grain
          grainIntensity={0.015}
          mouseInteraction
          mouseStrength={0.3}
          lightMode={!isDark}
          backgroundColor={isDark ? "#0b0b0c" : "#ffffff"}
        />
      </div>
      <div className={styles.content}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </div>
    </div>
  );
}
