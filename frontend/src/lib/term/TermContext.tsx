"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getAccessToken } from "@/lib/api/client";
import { decodeTokenIdentity, canSteerTermRole } from "@/lib/auth/roles";
import {
  clearStoredTerm,
  purgeLegacyTermStorage,
  readStoredTerm,
  readTermPrompt,
  writeStoredTerm,
  writeTermPrompt,
  type StoredTerm,
} from "@/lib/term/termStorage";

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

/** The term a term-steering role selected (teachers, principal). */
export type ActiveTerm = StoredTerm;

/** Server-marked active school year (from `/api/academics/school-years`). */
export interface ActiveSchoolYear {
  id: string;
  name: string;
}

async function fetchSchoolYears(): Promise<SchoolYearOption[]> {
  const { data } = await apiClient.get<{ schoolYears: SchoolYearOption[] }>(
    "/api/academics/school-years",
  );
  return data.schoolYears ?? [];
}

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
  activeSchoolYear: ActiveSchoolYear | null;
  termReady: boolean;
  setActiveTerm: (term: ActiveTerm) => void;
  /** Drop the stored pick so pages follow the server's active scope again. */
  clearActiveTerm: () => void;
  promptRequired: boolean;
  setPromptRequired: (required: boolean) => void;
}

const TermContext = React.createContext<TermContextValue | null>(null);

export function TermProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [activeTerm, setActiveTermState] = React.useState<ActiveTerm | null>(null);
  const [promptRequired, setPromptRequiredState] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  // Decoded fresh each render so login/logout/account switches are picked up
  // as soon as the provider re-renders (e.g. when LoginForm sets the prompt).
  const identity = decodeTokenIdentity(getAccessToken());
  const userSub = identity?.sub ?? null;
  const steersTerm = identity ? canSteerTermRole(identity.role) : false;

  const hasToken = ready && getAccessToken() != null;

  const query = useQuery({
    queryKey: ["term-picker", "school-years"],
    queryFn: fetchSchoolYears,
    enabled: hasToken,
    staleTime: 60_000,
    retry: 1,
  });

  React.useEffect(() => {
    purgeLegacyTermStorage();
  }, []);

  // Load the CURRENT user's stored term whenever the signed-in account
  // changes (mount, login, account switch) — never another account's value.
  React.useEffect(() => {
    setActiveTermState(readStoredTerm(userSub));
    setPromptRequiredState(readTermPrompt());
    setReady(true);
  }, [userSub]);

  // Cross-tab/focus sync: another tab can change the term or the prompt flag.
  React.useEffect(() => {
    const sync = () => {
      const nextSub = decodeTokenIdentity(getAccessToken())?.sub ?? null;
      const next = readStoredTerm(nextSub);
      setActiveTermState((prev) => {
        const unchanged =
          prev === next ||
          (prev !== null &&
            next !== null &&
            prev.termId === next.termId &&
            prev.schoolYearId === next.schoolYearId);
        if (unchanged) return prev;
        void queryClient.invalidateQueries({
          predicate: (q) =>
            q.queryKey[0] !== "term-picker" && q.queryKey[0] !== "school-years",
        });
        return next;
      });
      setPromptRequiredState(readTermPrompt());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, [queryClient]);

  const setActiveTerm = React.useCallback(
    (term: ActiveTerm) => {
      setActiveTermState((prev) => {
        if (prev?.termId !== term.termId || prev?.schoolYearId !== term.schoolYearId) {
          void queryClient.invalidateQueries({
            predicate: (q) =>
              q.queryKey[0] !== "term-picker" && q.queryKey[0] !== "school-years",
          });
        }
        return term;
      });
      const sub = decodeTokenIdentity(getAccessToken())?.sub ?? null;
      writeStoredTerm(sub, term);
    },
    [queryClient],
  );

  const clearActiveTerm = React.useCallback(() => {
    const sub = decodeTokenIdentity(getAccessToken())?.sub ?? null;
    clearStoredTerm(sub);
    setActiveTermState(null);
    void queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey[0] !== "term-picker" && q.queryKey[0] !== "school-years",
    });
  }, [queryClient]);

  const setPromptRequired = React.useCallback((required: boolean) => {
    setPromptRequiredState(required);
    writeTermPrompt(required);
  }, []);

  const activeSchoolYear = React.useMemo<ActiveSchoolYear | null>(() => {
    const active = (query.data ?? []).find((y) => y.isActive);
    return active ? { id: active.id, name: active.name } : null;
  }, [query.data]);

  const value = React.useMemo<TermContextValue>(
    () => ({
      schoolYears: query.data ?? [],
      isLoading: query.isLoading,
      isError: query.isError,
      // Roles that cannot steer the term never see term state, even if a stale
      // value exists in storage.
      activeTerm: steersTerm ? activeTerm : null,
      activeSchoolYear,
      termReady: ready,
      setActiveTerm,
      clearActiveTerm,
      promptRequired,
      setPromptRequired,
    }),
    [
      query.data,
      query.isLoading,
      query.isError,
      steersTerm,
      activeTerm,
      activeSchoolYear,
      ready,
      setActiveTerm,
      clearActiveTerm,
      promptRequired,
      setPromptRequired,
    ],
  );

  return <TermContext.Provider value={value}>{children}</TermContext.Provider>;
}

export function useTerm(): TermContextValue {
  const ctx = React.useContext(TermContext);
  if (!ctx) throw new Error("useTerm must be used within TermProvider");
  return ctx;
}
