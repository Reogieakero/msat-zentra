"use client";

import * as React from "react";
import {
  COMPONENT_NAMES,
  COMPONENT_ORDER,
  type ClassComponent,
  type ComponentType,
} from "../../components/grading-data";
import styles from "./CategoryTabs.module.css";

type Props = {
  value: ComponentType;
  onChange: (tab: ComponentType) => void;
  components: ClassComponent[];
};

export function CategoryTabs({ value, onChange, components }: Props) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Assessment category">
      {COMPONENT_ORDER.map((t) => {
        const count = components.find((c) => c.type === t)?.assessments.length ?? 0;
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={value === t}
            className={`${styles.tab} ${value === t ? styles.tabActive : ""}`}
            onClick={() => onChange(t)}
          >
            {COMPONENT_NAMES[t]}
            <span className={styles.tabCount}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
