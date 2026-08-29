"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

type Theme = "light" | "dark";

export type FontPref = "inter" | "nunito";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "theme";

const FontContext = React.createContext<FontPref | null>(null);
const FONT_STORAGE_KEY = "zentra.font";

function getInitialFont(): FontPref {
  if (typeof window === "undefined") return "inter";
  const stored = window.localStorage.getItem(FONT_STORAGE_KEY);
  if (stored === "inter" || stored === "nunito") return stored;
  return "inter";
}

function applyFont(font: FontPref) {
  const root = document.documentElement;
  root.style.setProperty(
    "--font-sans",
    font === "nunito" ? "var(--font-nunito)" : "var(--font-inter)",
  );
}

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [font, setFontState] = React.useState<FontPref>("inter");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const initial = getInitialFont();
    setFontState(initial);
    applyFont(initial);
    setMounted(true);
  }, []);

  const setFont = React.useCallback((next: FontPref) => {
    setFontState(next);
    applyFont(next);
    try {
      window.localStorage.setItem(FONT_STORAGE_KEY, next);
    } catch {
      /* ignore storage failures */
    }
  }, []);

  const value = React.useMemo<FontPref>(
    () => (mounted ? font : "inter"),
    [font, mounted],
  );

  return (
    <FontContext.Provider value={value}>
      <FontSetter onSet={setFont} />
      {children}
    </FontContext.Provider>
  );
}

function FontSetter({ onSet }: { onSet: (f: FontPref) => void }) {
  // Expose the setter through context without re-rendering consumers.
  React.useEffect(() => {
    (window as unknown as { __zentraSetFont?: (f: FontPref) => void }).__zentraSetFont =
      onSet;
  }, [onSet]);
  return null;
}

export function useFont(): { font: FontPref; setFont: (f: FontPref) => void } {
  const font = React.useContext(FontContext) ?? "inter";
  const setFont = React.useCallback((next: FontPref) => {
    const fn = (window as unknown as { __zentraSetFont?: (f: FontPref) => void })
      .__zentraSetFont;
    fn?.(next);
  }, []);
  return { font, setFont };
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("dark");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const initial = getInitialTheme();
    setThemeState(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore storage failures */
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme: mounted ? theme : "dark", resolvedTheme: theme, setTheme }),
    [theme, mounted, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    return { theme: "dark" as Theme, resolvedTheme: "dark" as Theme, setTheme: () => {} };
  }
  return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <FontProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="top-right" />
        </QueryClientProvider>
      </FontProvider>
    </ThemeProvider>
  );
}
