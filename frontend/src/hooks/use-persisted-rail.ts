"use client";
import { useEffect, useState } from "react";
export function usePersistedRail(key: string, defaultOpen = true) {
  const [railOpen, setRailOpenState] = useState(defaultOpen);
  useEffect(() => {
    const apply = () => {
      try {
        const stored = window.localStorage.getItem(key);
        if (stored === "open" || stored === "closed") {
          setRailOpenState((current) =>
            (current ? "open" : "closed") === stored ? current : stored === "open",
          );
        }
      } catch {
      }
    };
    apply();
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, [key]);
  const setRailOpen = (next: boolean | ((v: boolean) => boolean)) => {
    setRailOpenState((prev) => {
      const value = typeof next === "function" ? (next as (v: boolean) => boolean)(prev) : next;
      try {
        window.localStorage.setItem(key, value ? "open" : "closed");
      } catch {
      }
      return value;
    });
  };
  return [railOpen, setRailOpen] as const;
}
