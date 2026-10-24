"use client";

import styles from "./guidance-adm-reports.module.css";

/** Numeric facts inside a line — amber, so figures pop out of the prose. */
export function GuidanceAdmNumberText({ children }: { children: string }) {
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
