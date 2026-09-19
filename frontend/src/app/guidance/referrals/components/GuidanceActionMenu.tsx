"use client";

import {
  ADM_MENU,
  COUNSELING_MENU,
  trackMenuCounts,
  type GuidanceAction,
  type GuidanceActionValue,
  type GuidanceTrack,
  type GuidanceTypeFilter,
} from "./guidance-referrals-format";
import type { GuidanceReferralsSummary } from "./guidance-referrals-data";
import styles from "./GuidanceActionMenu.module.css";

/* Right sidebar — separate Counseling vs ADM menus mirroring the nurse
   desk. Each link picks one action (type + status + gates, server-side);
   the per-track server total sits on the right. */
export function GuidanceActionMenu({
  action,
  summary,
  typeFilter,
  onPick,
  onClear,
}: {
  action: GuidanceAction;
  summary: GuidanceReferralsSummary | null;
  typeFilter: GuidanceTypeFilter;
  onPick: (value: GuidanceActionValue) => void;
  onClear: () => void;
}) {
  function group(
    track: GuidanceTrack,
    title: string,
    items: { value: GuidanceActionValue; label: string }[],
    gapTop: boolean
  ) {
    const counts = trackMenuCounts(summary, track);
    return (
      <>
        <p className={`${styles.groupLabel}${gapTop ? ` ${styles.groupGap}` : ""}`}>
          {title}
        </p>
        {items.map((item, index) => {
          const active = action === item.value;
          const count = counts[item.value];
          const isLast = index === items.length - 1;
          return (
            <button
              key={item.value}
              type="button"
              className={`${styles.row}${isLast ? ` ${styles.rowLast}` : ""}${active ? ` ${styles.rowActive}` : ""}`}
              onClick={() => onPick(item.value)}
              aria-pressed={active}
              aria-label={`Show ${track} ${item.label} cases, ${count} cases`}
            >
              <span>{item.label}</span>
              <span className={styles.count} aria-hidden="true">
                {count}
              </span>
            </button>
          );
        })}
      </>
    );
  }

  const showCounseling = typeFilter !== "ADM";
  const showAdm = typeFilter !== "Counseling";

  return (
    <aside aria-label="Action filters" className={styles.sidebar}>
      {showAdm && group("ADM", "ADM actions", ADM_MENU, false)}
      {showCounseling && group("Counseling", "Counseling actions", COUNSELING_MENU, showAdm)}
      {action !== "" && (
        <button type="button" className={styles.showAll} onClick={onClear}>
          Show all
        </button>
      )}
    </aside>
  );
}
