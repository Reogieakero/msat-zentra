"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { LayoutDashboard, Users, ClipboardList, Bell, Settings } from "lucide-react";
import styles from "./Hero.module.css";
import { startFluidBackground, defaultFluidConfig, FluidConfig } from "@/lib/fluid/fluidBackground";

const heroFluidConfig: FluidConfig = {
  ...defaultFluidConfig,
  TRANSPARENT: false,
  BACK_COLOR: { r: 255, g: 255, b: 255 },
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

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stop = startFluidBackground(canvas, heroFluidConfig);
    return stop;
  }, []);

  return (
    <section id="overview" className={styles.hero}>
      <canvas ref={canvasRef} className={styles.bg} aria-hidden />
      <div className={styles.scrim} aria-hidden />
      <div className={styles.tint} aria-hidden />
      <div className={styles.grid}>
        <div className={styles.left}>
          <p className={styles.eyebrow}>Mati School of Arts and Trades</p>
          <h1 className={styles.title}>One record, every learner signal.</h1>
          <p className={styles.lede}>
            Grading, attendance, anecdotal records, and early-intervention risk —
            unified for teachers, guidance, and school leadership.
          </p>
          <div className={styles.ctaBlock}>
            <Link href="/login" className={styles.ctaCard}>
              <span className={styles.ctaTitle}>Sign in</span>
              <span className={styles.ctaText}>Open your MSAT workspace</span>
            </Link>
            <Link href="#how" className={styles.ctaCard}>
              <span className={styles.ctaTitle}>See how it works</span>
              <span className={styles.ctaText}>From capture to intervention</span>
            </Link>
          </div>
          <div className={styles.links}>
            <Link href="#modules" className={styles.textLink}>Explore modules</Link>
            <Link href="#roles" className={styles.textLink}>See the roles</Link>
            <Link href="#security" className={styles.textLink}>How we keep it confidential</Link>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.browser} role="img" aria-label="MSAT system preview">
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
