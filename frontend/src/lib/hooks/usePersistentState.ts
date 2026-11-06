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

export function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = React.useState<T>(defaultValue);

  React.useEffect(() => {
    const stored = readStorage<T>(key, defaultValue);

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

        }
        return resolved;
      });
    },
    [key]
  );

  return [value, set];
}
