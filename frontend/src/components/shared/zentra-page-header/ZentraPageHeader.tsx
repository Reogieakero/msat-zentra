import * as React from "react";
import styles from "./ZentraPageHeader.module.css";

export interface ZentraPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function ZentraPageHeader({ title, description, actions }: ZentraPageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.subtitle}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </div>
  );
}
