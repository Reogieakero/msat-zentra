import * as React from "react";
import type { FluidHue } from "@/components/auth/FluidBackground";

const STORAGE_KEY = "zentra.fluidHue";
const VALID: FluidHue[] = ["green", "blue", "amber"];

export function useFluidHue(): [FluidHue, (hue: FluidHue) => void] {
  const [hue, setHueState] = React.useState<FluidHue>("green");

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as FluidHue | null;
      if (stored && VALID.includes(stored)) setHueState(stored);
    } catch {
      /* ignore unavailable storage */
    }
  }, []);

  const setHue = React.useCallback((next: FluidHue) => {
    setHueState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore unavailable storage */
    }
  }, []);

  return [hue, setHue];
}
