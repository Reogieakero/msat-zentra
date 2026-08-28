import * as React from "react";
import browser from "./admBrowser.module.css";
import header from "./admHeader.module.css";
import browserStyles from "../../risk/students/components/browserCardStyles.module.css";

export function AdmBrowser({
  tabs,
  activeTab,
  onTabChange,
  action,
  children,
}: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className={`${browserStyles.browserCard} ${browser.admBrowser}`}>
      <div className={browserStyles.browserTitleBar}>
        <span className={browserStyles.trafficLights} aria-hidden="true">
          <span className={browserStyles.lightRed} />
          <span className={browserStyles.lightYellow} />
          <span className={browserStyles.lightGreen} />
        </span>
        <div className={browser.admTabBar} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${browserStyles.tab} ${activeTab === tab.id ? browserStyles.tabActive : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {action && <div className={header.browserAction}>{action}</div>}
      </div>
      <div className={browserStyles.browserBody}>{children}</div>
    </article>
  );
}
