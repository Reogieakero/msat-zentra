"use client";

import * as React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { getAccessToken } from "@/lib/api/client";
import { decodeTokenIdentity, isTeacherRole } from "@/lib/auth/roles";
import { useTerm } from "@/lib/term/TermContext";
import styles from "./ActiveTermBadge.module.css";

/**
 * The signed-in role lives in localStorage (inside the access token), so it is
 * an external store. `useSyncExternalStore` renders the server snapshot
 * (`false`) during SSR and hydration, then re-checks on the client; the
 * `storage` listener picks up cross-tab sign-in/out.
 */
function subscribeSession(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function isTeacherSession(): boolean {
  return isTeacherRole(decodeTokenIdentity(getAccessToken())?.role);
}

function serverIsTeacher(): boolean {
  return false;
}

export function ActiveTermBadge() {
  const { activeTerm, termReady, setPromptRequired } = useTerm();
  const isTeacher = React.useSyncExternalStore(
    subscribeSession,
    isTeacherSession,
    serverIsTeacher,
  );

  // Only teacher roles select a term; every other desk is scoped server-side.
  if (!isTeacher) return null;

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
