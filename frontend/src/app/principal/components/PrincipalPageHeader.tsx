import * as React from "react";
import styles from "./PrincipalPageHeader.module.css";

interface PrincipalPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

/* Unified compact header for every Principal page.
   Title 1.25rem/600, subtitle 0.8125rem muted.
   Heroes (HonorRollHero, AuroraBanner, carousels) render below as content. */
export function PrincipalPageHeader({
  title,
  description,
  actions,
}: PrincipalPageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <h1 className={styles.title}>{title}</h1>
        {description ? (
          <p className={styles.subtitle}>{description}</p>
        ) : null}
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </div>
  );
}
