import * as React from "react";
import { ArrowRight } from "lucide-react";
import { AnecdotalPanel } from "./AnecdotalPanel";
import { AttendancePanel } from "./AttendancePanel";
import { AdmPanel } from "./AdmPanel";
import { Sf10Panel } from "./Sf10Panel";
import type { TabDef, TabId } from "./data";
import styles from "./browser-window.module.css";

export function BrowserWindow({ tabs }: { tabs: TabDef[] }) {
  const [activeTab, setActiveTab] = React.useState<TabId>(tabs[0].id);

  return (
    <article className={styles.browserCard}>
      <div className={styles.browserTitleBar}>
        <span className={styles.trafficLights} aria-hidden="true">
          <span className={styles.lightRed} />
          <span className={styles.lightYellow} />
          <span className={styles.lightGreen} />
        </span>
        <div className={styles.tabBar} role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.tab} ${active ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className={styles.tabIcon} aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          hidden={activeTab !== tab.id}
          className={styles.browserBody}
        >
          {tab.id === "anecdotal" ? (
            <AnecdotalPanel href={tab.href} label={tab.label} />
          ) : tab.id === "attendance" ? (
            <AttendancePanel href={tab.href} label={tab.label} />
          ) : tab.id === "adm" ? (
            <AdmPanel href={tab.href} label={tab.label} />
          ) : tab.id === "sf10" ? (
            <Sf10Panel href={tab.href} label={tab.label} />
          ) : (
            <>
              <div className={styles.tabStatRow}>
                <span className={styles.tabStatIcon}>
                  <tab.icon size={20} />
                </span>
                <span className={styles.tabStatValue}>
                  {tab.value.toLocaleString()}
                </span>
              </div>
              <p className={styles.tabHint}>{tab.hint}</p>
              <a className={styles.tabLink} href={tab.href}>
                Open {tab.label}
                <ArrowRight aria-hidden />
              </a>
            </>
          )}
        </div>
      ))}
    </article>
  );
}
