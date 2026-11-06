"use client";

import * as React from "react";
import styles from "./nurse-adm.module.css";

/**
 * Renders a string with its numeric facts wrapped in the amber accent
 * (counts, percentages, day figures), so titles and interpretation lines
 * share one emphasis language.
 */
export function AdmNumberText({ children }: { children: string }) {
  // split keeps the numeric matches at odd indices (capturing group).
  const parts = children.split(/(\d+(?:\.\d+)?%?)/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={styles.numAccent}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
