"use client";

import * as React from "react";

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * React state that is backed by localStorage so the value survives page
 * refreshes and hard refreshes.
 *
 * - Hydration happens on mount via queueMicrotask (avoiding the
 *   react-hooks/set-state-in-effect violation and any hydration mismatch).
 * - Writes go to localStorage synchronously inside the setter, matching the
 *   existing convention used in the principal overview/filters.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = React.useState<T>(defaultValue);

  React.useEffect(() => {
    const stored = readStorage<T>(key, defaultValue);
    // Compare by snapshot so we don't clobber an already-persisted value with
    // the default on a no-op mount.
    if (JSON.stringify(stored) !== JSON.stringify(defaultValue)) {
      queueMicrotask(() => setValue(stored));
    }
  }, [key, defaultValue]);

  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // ignore write failures (private mode, quota, etc.)
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, set];
}
