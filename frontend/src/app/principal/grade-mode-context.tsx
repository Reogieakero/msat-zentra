"use client";

import * as React from "react";

export type GradeMode = "raw" | "final";

const STORAGE_KEY = "zentra.gradeMode";

export interface GradeModeContextValue {
  gradeMode: GradeMode;
  setGradeMode: (mode: GradeMode) => void;
}

const GradeModeContext = React.createContext<GradeModeContextValue | null>(null);

export function GradeModeProvider({ children }: { children: React.ReactNode }) {
  const [gradeMode, setGradeModeState] = React.useState<GradeMode>("final");

  // Restore the persisted basis after mount without a synchronous state update
  // in the effect body (avoids cascading renders during hydration).
  React.useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "raw" || saved === "final") {
      queueMicrotask(() => setGradeModeState(saved));
    }
  }, []);

  const setGradeMode = React.useCallback((mode: GradeMode) => {
    setGradeModeState(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const value = React.useMemo<GradeModeContextValue>(
    () => ({ gradeMode, setGradeMode }),
    [gradeMode, setGradeMode]
  );

  return <GradeModeContext.Provider value={value}>{children}</GradeModeContext.Provider>;
}

export function useGradeMode(): GradeModeContextValue {
  const ctx = React.useContext(GradeModeContext);
  if (!ctx) {
    throw new Error("useGradeMode must be used within a GradeModeProvider");
  }
  return ctx;
}
