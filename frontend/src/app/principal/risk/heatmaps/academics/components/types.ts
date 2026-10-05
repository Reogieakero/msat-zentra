"use client";

import type * as React from "react";

export type BackendSubjectGrade = {
  subject: string;
  transmutedGrade: number;
};

export type BackendStudentRow = {
  studentId: string;
  name: string;
  overallAverage: number;
  subjects: BackendSubjectGrade[];
};

export type BackendSectionRow = {
  sectionId: string;
  section: string;
  grade: string;
  avgTransmuted: number;
  students: BackendStudentRow[];
};

export type BackendAcademicSummary = {
  schoolYear: string;
  termLabel: string;
  sections: BackendSectionRow[];
};

export type CellData = {
  avg: number;
  graded: number;
  below: number;
};

export type AttentionItem = {
  sectionId: string;
  section: string;
  subject: string;
  avg: number;
  graded: number;
  below: number;
};

/** Grade-filter sentinel for the live academic trend (all grade levels). */
export const ALL_GRADES = "__all__";

export function gradeSortKey(grade: string): number {
  const m = String(grade).match(/\d+/);
  return m ? Number(m[0]) : 99;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Green shades for passing, solid red only for below-75. */
export function avgStyle(avg: number | null): React.CSSProperties {
  if (avg === null) {
    return {
      background: "color-mix(in oklch, var(--foreground) 6%, transparent)",
      color: "var(--muted-foreground)",
      fontWeight: 400,
    };
  }
  if (avg < 75) {
    return {
      background: "var(--destructive)",
      color: "var(--destructive-foreground, #fff)",
    };
  }
  if (avg >= 90) {
    return {
      background: "var(--primary)",
      color: "var(--primary-foreground)",
    };
  }
  if (avg >= 80) {
    return {
      background: "color-mix(in oklch, var(--primary) 45%, var(--card))",
      color: "var(--foreground)",
    };
  }
  return {
    background: "color-mix(in oklch, var(--primary) 16%, var(--card))",
    color: "var(--foreground)",
  };
}
