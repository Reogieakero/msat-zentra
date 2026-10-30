"use client";

import * as React from "react";
import { CalendarDays, Check, RotateCcw } from "lucide-react";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resolveDefaultTerm,
  useTerm,
  type ActiveTerm,
  type SchoolYearOption,
} from "@/lib/term/TermContext";
import sectionStyles from "./settings-section.module.css";
import styles from "./settings-term.module.css";

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return "Dates not set";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function termStatus(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (s <= now && now <= e) return "Ongoing";
  if (now < s) return "Upcoming";
  return "Ended";
}

/**
 * School-wide term scope for the principal desk. Unlike a teacher's per-desk
 * pick, this one is stored on the principal's account and carried on every
 * principal request (see the api client's term headers), so every principal
 * page — overview, honor roll, risk, ADM, academics — reads the same term.
 *
 * With nothing stored the desk follows the school default: the active school
 * year and the term whose dates cover today (same rule the server uses).
 */
export function TermScopeCard() {
  const {
    schoolYears,
    isLoading,
    activeTerm,
    setActiveTerm,
    clearActiveTerm,
    termReady,
  } = useTerm();

  const defaultTerm = React.useMemo<ActiveTerm | null>(() => {
    const year =
      schoolYears.find((y) => y.isActive) ?? schoolYears[0] ?? null;
    if (!year) return null;
    return resolveDefaultTerm([year]);
  }, [schoolYears]);

  const effective = activeTerm ?? defaultTerm;
  const year =
    schoolYears.find((y) => y.id === effective?.schoolYearId) ??
    schoolYears.find((y) => y.isActive) ??
    schoolYears[0] ??
    null;
  const terms = React.useMemo(
    () => [...(year?.terms ?? [])].sort((a, b) => a.termNumber - b.termNumber),
    [year],
  );
  const selectedTerm = terms.find((t) => t.id === effective?.termId) ?? null;

  const isCustom =
    !!activeTerm &&
    !!defaultTerm &&
    (activeTerm.schoolYearId !== defaultTerm.schoolYearId ||
      activeTerm.termId !== defaultTerm.termId);

  const pickYear = (next: SchoolYearOption) => {
    if (next.id === year?.id) return;
    const def = resolveDefaultTerm([next]);
    if (def) setActiveTerm(def);
  };

  const pickTerm = (termId: string) => {
    if (!year) return;
    const term = terms.find((t) => t.id === termId);
    if (!term) return;
    setActiveTerm({
      schoolYearId: year.id,
      schoolYearName: year.name,
      termId: term.id,
      termNumber: term.termNumber,
    });
  };

  const loading = !termReady || isLoading;

  const scopeLabel = year
    ? `${year.name} · Term ${selectedTerm?.termNumber ?? "—"}`
    : "No school year";

  return (
    <div id="section-term" className={sectionStyles.boardWrap}>
      <KanbanBoard
        title="Term & school year"
        icon={<CalendarDays size={14} aria-hidden="true" />}
        count={selectedTerm ? `Term ${selectedTerm.termNumber}` : "—"}
        description="Every principal page follows this scope. Pick a school year, then a term."
        ariaLabel="Term and school year settings"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
            <p className="text-xs text-muted-foreground">
              {isCustom
                ? `Viewing ${scopeLabel}.`
                : `Following the school default: ${scopeLabel}.`}
            </p>
            {isCustom ? (
              <Button type="button" size="sm" variant="outline" onClick={clearActiveTerm}>
                <RotateCcw size={13} aria-hidden="true" />
                Follow school default
              </Button>
            ) : null}
          </div>
        }
      >
        {loading ? (
          <div className="flex flex-col gap-2 px-1" aria-busy="true" aria-label="Loading terms">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ) : schoolYears.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted-foreground">
            No school years on record yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4 px-1">
            <div>
              <p className={styles.sectionLabel}>School year</p>
              <ul className={styles.yearList}>
                {schoolYears.map((y) => {
                  const selected = y.id === year?.id;
                  return (
                    <li key={y.id}>
                      <button
                        type="button"
                        onClick={() => pickYear(y)}
                        aria-pressed={selected}
                        className={`${styles.yearRow} ${selected ? styles.yearRowActive : ""}`}
                      >
                        <span className={styles.yearName}>{y.name}</span>
                        <span className={styles.yearMeta}>
                          {y.isActive
                            ? "Active"
                            : `${y.terms.length} term${y.terms.length === 1 ? "" : "s"}`}
                        </span>
                        {selected ? (
                          <span className={styles.yearCheck} aria-hidden="true">
                            <Check size={13} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className={styles.sectionLabel}>Term</p>
              <div className={styles.termGrid} role="radiogroup" aria-label="Term">
                {terms.map((t) => {
                  const selected = t.id === effective?.termId;
                  const status = termStatus(t.startDate, t.endDate);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => pickTerm(t.id)}
                      className={`${styles.termCard} ${selected ? styles.termCardActive : ""}`}
                    >
                      <span className={styles.termName}>Term {t.termNumber}</span>
                      {status ? (
                        <span
                          className={`${styles.status} ${
                            status === "Ongoing" ? styles.statusLive : ""
                          }`}
                        >
                          {status}
                        </span>
                      ) : null}
                      <span className={styles.termRange}>
                        {formatRange(t.startDate, t.endDate)}
                      </span>
                      <span className={styles.termHint}>
                        {selected ? "● Selected" : "○ Select term"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </KanbanBoard>
    </div>
  );
}
