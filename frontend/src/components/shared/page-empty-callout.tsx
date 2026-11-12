"use client";

import * as React from "react";
import { InsightCallout } from "@/components/ui/insight-callout";
import styles from "./page-empty-callout.module.css";

/**
 * Page-level empty state: the shared amber insight callout centered in the
 * content area (same treatment as the academics schedule / heatmap boards).
 * Use it when a desk has no data at all — empty messages belong here, never
 * inside a data table or chart board.
 *
 * `action` renders below the callout (e.g. a "Clear filters" button).
 * `fit` drops the viewport height so the callout fills whatever height its
 * parent already provides (use inside fit-to-viewport page sections).
 */
export function PageEmptyCallout({
  children,
  action,
  fit = false,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  fit?: boolean;
}) {
  return (
    <div className={`${styles.wrap} ${fit ? styles.fit : ""}`.trim()}>
      <InsightCallout role="status">{children}</InsightCallout>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
