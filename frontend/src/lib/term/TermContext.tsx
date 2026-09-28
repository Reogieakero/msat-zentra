"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getAccessToken } from "@/lib/api/client";

export interface TermOption {
  id: string;
  termNumber: number;
  startDate: string | null;
  endDate: string | null;
}

export interface SchoolYearOption {
  id: string;
  name: string;
  isActive: boolean;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
  terms: TermOption[];
}

export interface ActiveTerm {
  schoolYearId: string;
  schoolYearName: string;
  termId: string;
  termNumber: number;
}

const STORAGE_KEY = "zentra.activeTerm";
export const TERM_PROMPT_KEY = "zentra.termPrompt";

export function readStoredTerm(): ActiveTerm | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveTerm;
    if (!parsed.schoolYearId || !parsed.termId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredTerm(term: ActiveTerm) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(term));
  } catch {
    /* ignore storage failures */
  }
}

/** Set by LoginForm on every successful sign-in so the picker shows once per login. */
export function requestTermPrompt() {
  try {
    window.localStorage.setItem(TERM_PROMPT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearTermPrompt() {
  try {
    window.localStorage.removeItem(TERM_PROMPT_KEY);
  } catch {
    /* ignore */
  }
}

async function fetchSchoolYears(): Promise<SchoolYearOption[]> {
  const { data } = await apiClient.get<{ schoolYears: SchoolYearOption[] }>(
    "/api/academics/school-years",
  );
  return data.schoolYears ?? [];
}

/** Default term: today inside a term > active year Term 1 > first available. */
export function resolveDefaultTerm(years: SchoolYearOption[]): ActiveTerm | null {
  if (years.length === 0) return null;
  const now = Date.now();
  for (const y of years) {
    for (const t of y.terms) {
      if (!t.startDate || !t.endDate) continue;
      const s = new Date(t.startDate).getTime();
      const e = new Date(t.endDate).getTime();
      if (s <= now && now <= e) {
        return { schoolYearId: y.id, schoolYearName: y.name, termId: t.id, termNumber: t.termNumber };
      }
    }
  }
  const active = years.find((y) => y.isActive) ?? years[0];
  const first = [...active.terms].sort((a, b) => a.termNumber - b.termNumber)[0];
  if (!first) return null;
  return { schoolYearId: active.id, schoolYearName: active.name, termId: first.id, termNumber: first.termNumber };
}

interface TermContextValue {
  schoolYears: SchoolYearOption[];
  isLoading: boolean;
  isError: boolean;
  activeTerm: ActiveTerm | null;
  setActiveTerm: (term: ActiveTerm) => void;
  /** True when the post-login picker must be shown (set on every login). */
  promptRequired: boolean;
  setPromptRequired: (required: boolean) => void;
}

const TermContext = React.createContext<TermContextValue | null>(null);

export function TermProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [activeTerm, setActiveTermState] = React.useState<ActiveTerm | null>(null);
  const [promptRequired, setPromptRequiredState] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  // Hydrate persisted selection + login prompt flag on mount only.
  React.useEffect(() => {
    setActiveTermState(readStoredTerm());
    try {
      setPromptRequiredState(window.localStorage.getItem(TERM_PROMPT_KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // Re-sync the prompt flag when it changes outside React state (direct
  // localStorage writes, other tabs, OAuth callbacks) so the picker shows
  // on every login without exception.
  React.useEffect(() => {
    const sync = () => {
      try {
        setPromptRequiredState(window.localStorage.getItem(TERM_PROMPT_KEY) === "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const hasToken = ready && getAccessToken() != null;

  const query = useQuery({
    queryKey: ["term-picker", "school-years"],
    queryFn: fetchSchoolYears,
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  const setActiveTerm = React.useCallback(
    (term: ActiveTerm) => {
      setActiveTermState((prev) => {
        // Switching scope must refetch everything — every query is implicitly
        // scoped to the active term via request headers.
        if (prev?.termId !== term.termId || prev?.schoolYearId !== term.schoolYearId) {
          queryClient.invalidateQueries();
        }
        return term;
      });
      writeStoredTerm(term);
    },
    [queryClient],
  );

  const setPromptRequired = React.useCallback((required: boolean) => {
    setPromptRequiredState(required);
    if (required) requestTermPrompt();
    else clearTermPrompt();
  }, []);

  const value = React.useMemo<TermContextValue>(
    () => ({
      schoolYears: query.data ?? [],
      isLoading: query.isLoading,
      isError: query.isError,
      activeTerm,
      setActiveTerm,
      promptRequired,
      setPromptRequired,
    }),
    [query.data, query.isLoading, query.isError, activeTerm, setActiveTerm, promptRequired, setPromptRequired],
  );

  return <TermContext.Provider value={value}>{children}</TermContext.Provider>;
}

export function useTerm(): TermContextValue {
  const ctx = React.useContext(TermContext);
  if (!ctx) throw new Error("useTerm must be used within TermProvider");
  return ctx;
}
