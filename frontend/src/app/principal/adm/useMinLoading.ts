import * as React from "react";

export function useMinLoading(ms = 600) {
  const [loading, setLoading] = React.useState(true);
  const startRef = React.useRef<number>(0);
  const timerRef = React.useRef<number | null>(null);

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
