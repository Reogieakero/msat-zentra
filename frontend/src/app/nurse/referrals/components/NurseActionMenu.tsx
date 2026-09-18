"use client";

import * as React from "react";
import {
  ADM_MENU,
  CLINIC_MENU,
  type ActionFilter,
  type ActionValue,
  type TypeFilter,
} from "./nurse-referrals-format";
import styles from "./NurseActionMenu.module.css";

/* Right sidebar — per-type action menus. ADM and Clinic each get their
   own group; each link filters the timeline to that type + action and
   carries its count on the right. */
export function NurseActionMenu({
  actionFilter,
  counts,
  typeFilter,
  onPick,
  onClear,
}: {
  actionFilter: ActionFilter;
  counts: Record<ActionValue, number>;
  typeFilter: TypeFilter;
  onPick: (value: ActionValue, type: "ADM" | "Clinic") => void;
  onClear: () => void;
}) {
  function renderRow(
    item: { value: ActionValue; label: string },
    type: "ADM" | "Clinic",
    isLast: boolean
  ) {
    const active = actionFilter === item.value;
    const count = counts[item.value];
    return (
      <button
        key={item.value}
        type="button"
        className={`${styles.row}${isLast ? ` ${styles.rowLast}` : ""}${active ? ` ${styles.rowActive}` : ""}`}
        onClick={() => onPick(item.value, type)}
        aria-pressed={active}
        aria-label={`Show ${type} ${item.label} cases, ${count} cases`}
      >
        <span>{item.label}</span>
        <span className={styles.count} aria-hidden="true">
          {count}
        </span>
      </button>
    );
  }

  return (
    <aside aria-label="Action filters" className={styles.sidebar}>
      {typeFilter !== "Clinic" && (
        <>
          <p className={styles.groupLabel}>ADM actions</p>
          {ADM_MENU.map((item, index) =>
            renderRow(item, "ADM", index === ADM_MENU.length - 1 && typeFilter === "ADM")
          )}
        </>
      )}
      {typeFilter !== "ADM" && (
        <>
          <p className={`${styles.groupLabel}${typeFilter === "" ? ` ${styles.groupGap}` : ""}`}>
            Clinic actions
          </p>
          {CLINIC_MENU.map((item, index) =>
            renderRow(item, "Clinic", index === CLINIC_MENU.length - 1)
          )}
        </>
      )}
      {actionFilter !== "" && (
        <button type="button" className={styles.showAll} onClick={onClear}>
          Show all
        </button>
      )}
    </aside>
  );
}
