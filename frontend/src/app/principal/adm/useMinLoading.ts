import * as React from "react";

/**
 * Keeps a loading flag true for at least `ms` after it was last set true,
 * so skeleton UIs are perceivable even when the underlying fetch resolves
 * (or fails) near-instantly.
 */
export function useMinLoading(ms = 600) {
  const [loading, setLoading] = React.useState(true);
  const startRef = React.useRef<number>(0);
  const timerRef = React.useRef<number | null>(null);

  // Record the initial load start time after mount (avoids calling
  // Date.now() during render, which violates the Rules of Hooks).
  React.useEffect(() => {
    startRef.current = Date.now();
  }, []);

  const setMinLoading = React.useCallback(
    (value: boolean) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (value) {
        startRef.current = Date.now();
        setLoading(true);
        return;
      }
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, ms - elapsed);
      timerRef.current = window.setTimeout(() => setLoading(false), remaining);
    },
    [ms]
  );

  React.useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  return [loading, setMinLoading] as const;
}
