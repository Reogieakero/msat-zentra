"use client";

import * as React from "react";
import MoltenMetal, { type MoltenMetalProps } from "./molten-metal";
import GradientWaves, { type GradientWavesProps } from "./gradient-waves";
import LiquidEther, { type LiquidEtherProps } from "./liquid-ether";
import styles from "./kpi-card.module.css";

export type KpiCardProps = {
  icon?: React.ReactNode;
  value: string | number;
  label: string;
  description?: string;
  href?: string;
  loading?: boolean;
  /** Animated background variant behind the content. */
  background?: "none" | "molten" | "gradientWaves" | "liquidEther";
  moltenProps?: MoltenMetalProps;
  gradientWavesProps?: GradientWavesProps;
  liquidEtherProps?: LiquidEtherProps;
  className?: string;
};

export function KpiCard({
  icon,
  value,
  label,
  description,
  href,
  loading = false,
  background = "none",
  moltenProps,
  gradientWavesProps,
  liquidEtherProps,
  className,
}: KpiCardProps) {
  const hasBg = background !== "none";
  const isEther = background === "liquidEther";
  const content = (
    <>
      {hasBg && !isEther ? <span className={styles.scrim} aria-hidden /> : null}
      {background === "molten" ? <MoltenMetal {...moltenProps} className={styles.bg} /> : null}
      {background === "gradientWaves" ? (
        <GradientWaves {...gradientWavesProps} className={styles.bg} />
      ) : null}
      {isEther ? (
        <LiquidEther {...liquidEtherProps} className={styles.bg} />
      ) : null}
      <div className={styles.inner}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        <dd className={styles.value}>{value}</dd>
        <dt className={styles.label}>{label}</dt>
        {description ? <dd className={styles.description}>{description}</dd> : null}
      </div>
    </>
  );

  const classes = `${styles.card} ${hasBg && !isEther ? styles.cardMolten : ""} ${
    isEther ? styles.cardEther : ""
  } ${className ?? ""}`;

  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }
  return <div className={classes}>{content}</div>;
}
