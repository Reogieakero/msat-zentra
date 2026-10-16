"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./ActiveTermBadge.module.css";

export function ActiveTermBadge() {
  const { activeTerm, termReady, setPromptRequired } = useTerm();

  // SSR always renders the placeholder (activeTerm starts null). The stored
  // term only loads in a mount effect, and on client-side navigation the
  // context may already hold a term while the RSC snapshot had none — both
  // cases diverge from SSR HTML. Gate on termReady and suppress hydration
  // warnings for the client-persisted label.
  const showTerm = termReady && activeTerm;

  return (
    <button
      type="button"
      className={styles.badge}
      onClick={() => setPromptRequired(true)}
      aria-label={
        showTerm
          ? `Active scope: ${activeTerm.schoolYearName}, Term ${activeTerm.termNumber}. Change scope`
          : "No term selected. Select scope"
      }
      title="Active School Year & Term — click to change"
      suppressHydrationWarning
    >
      <CalendarDays className={styles.icon} aria-hidden />
      <span className={styles.label} suppressHydrationWarning>
        {showTerm ? `${activeTerm.schoolYearName} · Term ${activeTerm.termNumber}` : "Select term"}
      </span>
      <ChevronDown className={styles.chev} aria-hidden />
    </button>
  );
}
