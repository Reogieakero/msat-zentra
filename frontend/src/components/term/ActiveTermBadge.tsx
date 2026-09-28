"use client";

import * as React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./ActiveTermBadge.module.css";

/**
 * Global active School Year + Term indicator for role topbars.
 *
 * The selection is made once after login (TermSelectOverlay) and scopes
 * every read + write for the session. This badge only *displays* it —
 * clicking re-opens the picker so the user can intentionally switch scope
 * (which refetches all data). Pages never render their own year/term
 * pickers.
 */
export function ActiveTermBadge() {
  const { activeTerm, setPromptRequired } = useTerm();

  return (
    <button
      type="button"
      className={styles.badge}
      onClick={() => setPromptRequired(true)}
      aria-label={
        activeTerm
          ? `Active scope: ${activeTerm.schoolYearName}, Term ${activeTerm.termNumber}. Change scope`
          : "No term selected. Select scope"
      }
      title="Active School Year & Term — click to change"
    >
      <CalendarDays className={styles.icon} aria-hidden />
      <span className={styles.label}>
        {activeTerm ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}` : "Select term"}
      </span>
      <ChevronDown className={styles.chev} aria-hidden />
    </button>
  );
}
