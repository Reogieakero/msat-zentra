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
  /** Small muted line under the title. */
  sub?: string;
  /** Link label + target for button banners (unused when static). */
  cta?: string;
  href?: string;
  label: string;
  /** Fire ember dots inside the card (shared FireParticles, ~12). */
  particles?: boolean;
  /** State tint (e.g. schedule rail blue/green/gray): overrides
   *  --primary on this card only, so beams, embers, pill, and CTA all
   *  follow it instead of the user palette. */
  accent?: string;
  /** Static readout (role="status" div, no navigation, no CTA row)
   *  instead of a button. */
  static?: boolean;
}

/* Aurora banner card — primary-tinted beams across the top, fire
   particles rising inside, centered pill + big count + title + CTA.
   Used by the principal overview action banners and grade-grid
   banners so all six look identical. Grid stretch gives equal heights
   beside sibling cards. */
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
