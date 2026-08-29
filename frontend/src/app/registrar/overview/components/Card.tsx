import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import styles from "./card.module.css";

export function Card({
  title,
  mock = true,
  children,
  className,
}: {
  title: string;
  mock?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.card} ${className ?? ""}`}>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {mock ? (
          <Badge variant="outline" className={styles.mockTag}>
            MOCK
          </Badge>
        ) : null}
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

export function Kpi({
  icon,
  value,
  label,
  href,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className={styles.kpiIcon}>{icon}</span>
      <dd className={styles.kpiValue}>{value}</dd>
      <dt className={styles.kpiLabel}>{label}</dt>
    </>
  );
  return href ? (
    <Link href={href} className={styles.kpi}>
      {inner}
    </Link>
  ) : (
    <div className={styles.kpi}>{inner}</div>
  );
}
