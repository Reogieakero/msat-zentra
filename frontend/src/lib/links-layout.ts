"use client";

import * as React from "react";

export type LinksLayout = "sidebar" | "navbar";

const STORAGE_KEY = "zentra.settings-links-layout";

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
    }
  };
  return [mode, set];
}
