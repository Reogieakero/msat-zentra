"use client";

import * as React from "react";
import styles from "./browser-card.module.css";

export function BrowserCard({
  tabs,
  activeTab,
  onTabChange,
  action,
  url,
  children,
}: {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  action?: React.ReactNode;
  url?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={styles.browserCard}>
      <div className={styles.browserTitleBar}>
        <span className={styles.trafficLights} aria-hidden="true">
          <span className={styles.lightRed} />
          <span className={styles.lightYellow} />
          <span className={styles.lightGreen} />
        </span>
        {url ? <span className={styles.url}>{url}</span> : null}
        <div className={styles.tabBar} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
              {typeof tab.count === "number" && (
                <span
                  className={`${styles.tabBadge} ${
                    activeTab === tab.id ? styles.tabBadgeActive : ""
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {action && <div className={styles.browserAction}>{action}</div>}
      </div>
      <div className={styles.browserBody}>{children}</div>
    </article>
  );
}
