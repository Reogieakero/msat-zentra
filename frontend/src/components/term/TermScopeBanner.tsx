"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarRange, UserPlus } from "lucide-react";
import { useTermContext } from "@/services/teacher/termContext.service";
import styles from "./TermScopeBanner.module.css";

function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Layout-level strip that spells out the scope every teacher page is reading
 * from. Grades, attendance, anecdotal records and reports are all written
 * against the selected term, so the strip names that term instead of leaving
 * the only cue in the topbar badge.
 */
export function TermScopeBanner() {
  const { data } = useTermContext();
  const term = data?.term ?? null;
  if (!term) return null;

  // A new school year has no previous roster yet: point the adviser at the
  // Advisory List instead of showing the carry-over confirmation.
  const needsEnlist =
    !!data?.isAdviser &&
    data.baseline === "none" &&
    data.roster.total === 0 &&
    !!data.previousTerm;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.scope}>
        <CalendarRange size={14} className={styles.icon} aria-hidden />
        <strong className={styles.year}>{term.schoolYearName}</strong>
        <span className={styles.dot} aria-hidden>
          ·
        </span>
        <span>Term {term.termNumber}</span>
        {formatRange(term.startDate, term.endDate) ? (
          <>
            <span className={styles.dot} aria-hidden>
              ·
            </span>
            <span className={styles.dates}>
              {formatRange(term.startDate, term.endDate)}
            </span>
          </>
        ) : null}
      </span>

      {needsEnlist ? (
        <Link href="/teacher/advisory/list" className={styles.enlist}>
          <UserPlus size={13} aria-hidden />
          New school year — enlist your section&apos;s learners
        </Link>
      ) : (
        <span className={styles.note}>
          Records for Term {term.termNumber} are new for this term — grades,
          attendance, anecdotal records and reports start empty.
        </span>
      )}
    </div>
  );
}
