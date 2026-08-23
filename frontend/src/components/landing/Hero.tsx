"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, Users, ClipboardList, Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./Hero.module.css";
import { startFluidBackground, defaultFluidConfig, FluidConfig } from "@/lib/fluid/fluidBackground";

function buildFluidConfig(dark: boolean): FluidConfig {
  return {
    ...defaultFluidConfig,
    TRANSPARENT: false,
    BACK_COLOR: dark ? { r: 10, g: 10, b: 10 } : { r: 250, g: 250, b: 249 },
    COLORFUL: false,
    RANDOM_COLORS: false,
    SPLAT_HUE: 0.42,
    SUNRAYS: false,
    SHADING: false,
    DENSITY_DISSIPATION: 1.0,
    VELOCITY_DISSIPATION: 1.2,
    CURL: 6,
    SPLAT_RADIUS: 0.35,
  };
}

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Track the actual `.dark` class on <html> so the fluid background switches
  // to the black back-color reliably when dark mode is toggled.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stop = startFluidBackground(
      canvas,
      buildFluidConfig(isDark)
    );
    return stop;
  }, [isDark]);

  return (
    <section id="overview" className={styles.hero}>
      <canvas ref={canvasRef} className={styles.bg} aria-hidden />
      <div className={styles.scrim} aria-hidden />
      <div className={styles.tint} aria-hidden />
      <div className={styles.grid}>
        <div className={styles.left}>
          <div className={styles.eyebrowRow}>
            <span className={styles.eyebrowRule} aria-hidden="true" />
            <p className={styles.eyebrow}>Mati School of Arts and Trades</p>
          </div>
          <h1 className={styles.title}>
            One record, <span className={styles.titleAccent}>every learner signal.</span>
          </h1>
          <p className={styles.lede}>
            Grading, attendance, anecdotal records, and early-intervention risk —
            unified for teachers, guidance, and school leadership.
          </p>
          <div className={styles.ctaBlock}>
            <Button asChild size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="#how">
                See how it works
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
          <div className={styles.links}>
            <Link href="#modules" className={styles.textLink}>
              Explore modules
            </Link>
            <Link href="#roles" className={styles.textLink}>
              See the roles
            </Link>
            <Link href="#security" className={styles.textLink}>
              How we keep it confidential
            </Link>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.browser}>
            <div className={styles.browserBar}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.browserUrl}>msat.edu/workspace</span>
            </div>
            <div className={styles.browserBody}>
              <aside className={styles.sidebar}>
                <Link href="#overview" className={`${styles.sideItem} ${styles.sideActive}`} aria-label="Dashboard">
                  <LayoutDashboard size={18} />
                </Link>
                <Link href="#roles" className={styles.sideItem} aria-label="Students">
                  <Users size={18} />
                </Link>
                <Link href="#modules" className={styles.sideItem} aria-label="Records">
                  <ClipboardList size={18} />
                </Link>
                <Link href="#security" className={styles.sideItem} aria-label="Alerts">
                  <Bell size={18} />
                </Link>
                <Link href="#how" className={styles.sideItem} aria-label="Settings">
                  <Settings size={18} />
                </Link>
              </aside>
              <div className={styles.canvasArea}>
                <div className={styles.cardRow}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Attendance</span>
                    <span className={styles.statValue}>96%</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>At-risk</span>
                    <span className={styles.statValue}>7</span>
                  </div>
                </div>
                <div className={styles.chart}>
                  <span className={styles.bar} style={{ height: "40%" }} />
                  <span className={styles.bar} style={{ height: "70%" }} />
                  <span className={styles.bar} style={{ height: "55%" }} />
                  <span className={styles.bar} style={{ height: "85%" }} />
                  <span className={styles.bar} style={{ height: "60%" }} />
                  <span className={styles.bar} style={{ height: "95%" }} />
                  <span className={styles.bar} style={{ height: "48%" }} />
                </div>
                <div className={styles.timeline}>
                  <span className={styles.tNode} />
                  <span className={styles.tLine} />
                  <span className={styles.tNode} />
                  <span className={styles.tLine} />
                  <span className={styles.tNode} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
