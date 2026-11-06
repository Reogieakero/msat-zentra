"use client";

import * as React from "react";

/**
 * Persisted open/closed state for a desk's left rail (teacher, principal,
 * nurse, guidance, coordinator, registrar, record keeper).
 *
 * Every desk starts collapsed — icon-only, with hover tooltips — exactly
 * like the teacher desk, and remembers the user's last choice per desk.
 */
export function useCollapsibleSidebar(storageKey: string) {
  const [collapsed, setCollapsed] = React.useState(true);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "0" || stored === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted rail state after mount
        setCollapsed(stored === "1");
      }
    } catch {
      /* private mode — stay collapsed */
    }
  }, [storageKey]);

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* private mode — keep in-memory only */
      }
      return next;
    });
  }, [storageKey]);

  return { collapsed, toggle };
}
