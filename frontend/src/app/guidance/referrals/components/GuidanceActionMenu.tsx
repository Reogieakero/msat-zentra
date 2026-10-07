"use client";

import { ListFilter } from "lucide-react";
import {
  ADM_MENU,
  COUNSELING_MENU,
  trackMenuCounts,
  type GuidanceAction,
  type GuidanceActionValue,
  type GuidanceTrack,
  type GuidanceTypeFilter,
} from "./guidance-referrals-format";
import type { GuidanceReferralsSummary } from "@/services/guidance/guidance.types";
import styles from "./GuidanceActionMenu.module.css";

/* Right sidebar — separate Counseling vs ADM menus mirroring the nurse
   desk. Each link picks one action (type + status + gates, server-side);
   the per-track server total sits on the right. The Cancelled rows need
   the dismissal actor (client-only), so they render only on the locked
   full-list pages (showCancelled) — the unlocked All page has no server
   equivalent and would show a wrong list. */
export function GuidanceActionMenu({
  action,
  summary,
  typeFilter,
  onPick,
  onClear,
  showCancelled = false,
}: {
  action: GuidanceAction;
  summary: GuidanceReferralsSummary | null;
  typeFilter: GuidanceTypeFilter;
  onPick: (value: GuidanceActionValue) => void;
  onClear: () => void;
  showCancelled?: boolean;
}) {
  function group(
    track: GuidanceTrack,
    title: string,
    items: { value: GuidanceActionValue; label: string }[],
    gapTop: boolean
  ) {
    const counts = trackMenuCounts(summary, track);
    const visible = showCancelled ? items : items.filter((i) => !i.value.endsWith("_cancelled"));
    return (
      <>
        <p className={`${styles.groupLabel}${gapTop ? ` ${styles.groupGap}` : ""}`}>
          {title}
        </p>
        {visible.map((item, index) => {
          const active = action === item.value;
          const count = counts[item.value];
          const isLast = index === visible.length - 1;
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
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <ListFilter size={18} className="text-primary" />
        </span>
        <div className="min-w-0">
          <p className={styles.menuTitle}>Case actions</p>
          <p className={styles.menuDesc}>Filter the timeline.</p>
        </div>
      </div>
      <div className="relative">
      {showAdm && group("ADM", "ADM actions", ADM_MENU, false)}
      {showCounseling && group("Counseling", "Counseling actions", COUNSELING_MENU, showAdm)}
      {action !== "" && (
        <button type="button" className={styles.showAll} onClick={onClear}>
          Show all
        </button>
      )}
      </div>
    </aside>
  );
}
