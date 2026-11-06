"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { FireParticles } from "@/components/ui/fire-particles";
import styles from "./aurora-banner.module.css";

interface AuroraBannerProps {
  icon: React.ComponentType<{ className?: string }>;
  pill: string;
  count: React.ReactNode;
  title: string;
  sub?: string;
  cta?: string;
  href?: string;
  label: string;
  particles?: boolean;
  accent?: string;
  static?: boolean;
}

export function AuroraBanner({
  icon: Icon,
  pill,
  count,
  title,
  sub,
  cta,
  href,
  label,
  particles = true,
  accent,
  static: isStatic = false,
}: AuroraBannerProps) {
  const router = useRouter();

  const body = (
    <>
      <span className={styles.beams} aria-hidden="true" />
      {particles ? <FireParticles count={12} className={styles.embers} /> : null}
      <span className={styles.bannerBody}>
        <span className={styles.bannerPill}>
          <Icon className={styles.bannerPillIcon} aria-hidden />
          {pill}
        </span>
        <span className={styles.bannerCount}>{count}</span>
        <span className={styles.bannerTitle}>{title}</span>
        {sub ? <span className={styles.bannerSub}>{sub}</span> : null}
        {!isStatic ? (
          <span className={styles.bannerCta}>
            {cta}
            <ArrowRight className={styles.bannerCtaIcon} aria-hidden />
          </span>
        ) : null}
      </span>
    </>
  );

  const style = accent
    ? ({ "--primary": accent } as React.CSSProperties)
    : undefined;

  if (isStatic) {
    return (
      <div
        className={`${styles.banner} ${styles.static}`}
        style={style}
        role="status"
        aria-label={label}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.banner}
      style={style}
      onClick={() => router.push(href ?? "")}
      aria-label={label}
    >
      {body}
    </button>
  );
}
