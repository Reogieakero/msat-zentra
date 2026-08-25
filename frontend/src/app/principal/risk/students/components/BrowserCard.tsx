import * as React from "react";
import { Search } from "lucide-react";
import styles from "./browserCardStyles.module.css";

export function BrowserCard({
  title,
  tabs,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  children,
}: {
  title: string;
  tabs: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  const [internal, setInternal] = React.useState(tabs[0]?.id);
  const active = activeTab ?? internal;
  const setActive = (id: string) => {
    if (onTabChange) onTabChange(id);
    else setInternal(id);
  };

  return (
    <article className={styles.browserCard}>
      <div className={styles.browserTitleBar}>
        <span className={styles.trafficLights} aria-hidden="true">
          <span className={styles.lightRed} />
          <span className={styles.lightYellow} />
          <span className={styles.lightGreen} />
        </span>
        <span className={styles.url}>{title}</span>
        <div className={styles.tabBar} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              className={`${styles.tab} ${active === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.browserBody}>
        {onSearchChange ? (
          <div className={styles.searchToolbar}>
            <div className={styles.searchWrap}>
              <Search size={13} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search LRN…"
                value={search ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Search students by LRN"
              />
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </article>
  );
}
