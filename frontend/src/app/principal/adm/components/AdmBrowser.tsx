import * as React from "react";
import browser from "./admBrowser.module.css";
import header from "./admHeader.module.css";

export function AdmBrowser({
  tabs,
  activeTab,
  onTabChange,
  action,
  children,
}: {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className={`${browser.browserCard} ${browser.admBrowser}`}>
      <div className={browser.browserTitleBar}>
        <span className={browser.trafficLights} aria-hidden="true">
          <span className={browser.lightRed} />
          <span className={browser.lightYellow} />
          <span className={browser.lightGreen} />
        </span>
        <div className={browser.admTabBar} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${browser.tab} ${activeTab === tab.id ? browser.tabActive : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
              {typeof tab.count === "number" && (
                <span
                  className={`${browser.tabBadge} ${
                    activeTab === tab.id ? browser.tabBadgeActive : ""
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        {action && <div className={header.browserAction}>{action}</div>}
      </div>
      <div className={browser.browserBody}>{children}</div>
    </article>
  );
}
