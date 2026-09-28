"use client";

import * as React from "react";

export type LinksLayout = "sidebar" | "navbar";

const STORAGE_KEY = "zentra.settings-links-layout";

/** Persisted links-layout choice shared by the teacher role sidebar and
 *  the settings page toggle. The first render is always the default
 *  (server and client agree — no hydration mismatch); the stored value
 *  applies in an effect right after mount, and the `storage` listener
 *  keeps open tabs in sync. */
export function useLinksLayout(): [LinksLayout, (mode: LinksLayout) => void] {
  const [mode, setMode] = React.useState<LinksLayout>("sidebar");
  React.useEffect(() => {
    const apply = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "navbar" || stored === "sidebar") {
          setMode((current) => (current === stored ? current : stored));
        }
      } catch {
        // Private mode etc. — default holds for the visit.
      }
    };
    apply();
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, []);
  const set = (next: LinksLayout) => {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode etc. — choice holds for the visit.
    }
  };
  return [mode, set];
}
