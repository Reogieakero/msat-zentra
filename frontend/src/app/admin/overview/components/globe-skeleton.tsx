"use client";

import styles from "./presence-globe.module.css";

/**
 * Loading shell for the live-presence globe. Mirrors the rendered globe's size
 * and right-of-centre placement so the board does not jump when three.js and
 * the first presence payload land.
 */
export default function GlobeSkeleton() {
  return (
    <div
      className={styles.skeletonWrap}
      role="status"
      aria-label="Loading live presence"
    >
      <div className={`animate-pulse bg-muted ${styles.skeletonGlobe}`} />
    </div>
  );
}
