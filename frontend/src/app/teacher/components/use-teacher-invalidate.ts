"use client";

import { useQueryClient } from "@tanstack/react-query";

/**
 * Shared teacher-desk invalidation prefixes.
 *
 * Centralizing the keys here prevents drift: every teacher mutation
 * refreshes exactly the teacher queries and nothing else — no whole-app
 * refetch, no stale desk after a write. Always includes
 * ["teacher-notifications"] so the bell badge bumps with every write.
 */
export const TEACHER_QUERY_KEYS = [
  ["teacher-overview"],
  ["teacher-overview-secondary"],
  ["teacher-student-list"],
  ["advisory-students"],
  ["advisee-academic"],
  ["advisee-attendance"],
  ["adm-my-cases"],
  ["myReferrals"],
  ["referableAnecdotal"],
  ["anecdotal-mine"],
  ["teacher-anecdotes"],
  ["teacher-notifications"],
  ["teacher-schedule"],
  ["teacher-schedule-subjects"],
  ["teacher-schedule-teachers"],
  ["teacher-schedule-config"],
  ["teacher-schedule-me"],
  ["teacher-my-slots"],
  ["teacher-grading-class"],
  ["teacher-settings-adviser-sections"],
  ["grade-flags"],
  ["attendance-sheet-marks"],
  ["attendance-subject-days"],
  ["attendance-section-summary"],
  ["attendance-section-matrix"],
  ["attendance-section-roster"],
  ["offered-subjects"],
] as const;

/**
 * Scoped invalidation groups — one attendance save must NOT refetch the
 * schedule board, gradebook, and overview. Each mutation calls only its
 * scope (plus the bell badge), keeping refetches targeted.
 */
export const TEACHER_SCOPE_KEYS = {
  marks: [
    ["attendance-sheet-marks"],
    ["attendance-subject-days"],
    ["attendance-section-summary"],
    ["attendance-section-matrix"],
    ["attendance-section-roster"],
    ["offered-subjects"],
  ],
  grading: [
    ["teacher-grading-class"],
    ["advisee-academic"],
    ["advisory-students"],
    ["teacher-overview"],
    ["teacher-overview-secondary"],
  ],
  schedule: [
    ["teacher-schedule"],
    ["teacher-schedule-subjects"],
    ["teacher-schedule-teachers"],
    ["teacher-schedule-config"],
    ["teacher-schedule-me"],
    ["teacher-my-slots"],
  ],
  overview: [
    ["teacher-overview"],
    ["teacher-overview-secondary"],
    ["teacher-student-list"],
  ],
  referrals: [["myReferrals"], ["referableAnecdotal"]],
  advisory: [
    ["advisory-students"],
    ["advisee-academic"],
    ["advisee-attendance"],
    ["adm-my-cases"],
  ],
  anecdotal: [["anecdotal-mine"], ["teacher-anecdotes"], ["referableAnecdotal"]],
  flags: [["grade-flags"]],
  notifications: [["teacher-notifications"]],
  settings: [["teacher-settings-adviser-sections"]],
} as const;

export type TeacherInvalidateScope = keyof typeof TEACHER_SCOPE_KEYS;

export function invalidateTeacherScope(
  queryClient: { invalidateQueries: (opts: { queryKey: string[] }) => void },
  scope: TeacherInvalidateScope,
) {
  for (const key of TEACHER_SCOPE_KEYS[scope]) {
    void queryClient.invalidateQueries({ queryKey: [...key] });
  }
  if (scope !== "notifications") {
    void queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] });
  }
}

export interface TeacherInvalidator {
  /** Full-desk invalidate — only for logout-type resets; prefer a scope. */
  all: () => void;
  marks: () => void;
  grading: () => void;
  schedule: () => void;
  overview: () => void;
  referrals: () => void;
  advisory: () => void;
  anecdotal: () => void;
  flags: () => void;
  settings: () => void;
  scope: (scope: TeacherInvalidateScope) => void;
}

export function useTeacherInvalidate(): TeacherInvalidator {
  const queryClient = useQueryClient();
  const run = (scope: TeacherInvalidateScope) =>
    invalidateTeacherScope(queryClient, scope);
  // Plain object (never mutated after creation) so the React Compiler
  // immutability lint stays green.
  return {
    all: () => {
      for (const key of TEACHER_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    },
    marks: () => run("marks"),
    grading: () => run("grading"),
    schedule: () => run("schedule"),
    overview: () => run("overview"),
    referrals: () => run("referrals"),
    advisory: () => run("advisory"),
    anecdotal: () => run("anecdotal"),
    flags: () => run("flags"),
    settings: () => run("settings"),
    scope: run,
  };
}
