"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  TEACHER_QUERY_KEYS,
  TEACHER_SCOPE_KEYS,
  keysForScopes,
  type TeacherInvalidateScope,
} from "@/lib/realtime/teacherKeys";

export { TEACHER_QUERY_KEYS, TEACHER_SCOPE_KEYS };
export type { TeacherInvalidateScope };

export function invalidateTeacherScope(
  queryClient: { invalidateQueries: (opts: { queryKey: string[] }) => void },
  scope: TeacherInvalidateScope | readonly TeacherInvalidateScope[],
) {
  const scopes = Array.isArray(scope) ? scope : [scope as TeacherInvalidateScope];
  for (const key of keysForScopes(scopes)) {
    void queryClient.invalidateQueries({ queryKey: [...key] });
  }
  if (!scopes.includes("notifications")) {
    void queryClient.invalidateQueries({ queryKey: ["teacher-notifications"] });
  }
}

export interface TeacherInvalidator {
  all: () => void;
  marks: () => void;
  grading: () => void;
  schedule: () => void;
  overview: () => void;
  referrals: () => void;
  advisory: () => void;
  modules: () => void;
  adm: () => void;
  anecdotal: () => void;
  flags: () => void;
  sf10: () => void;
  settings: () => void;
  scope: (scope: TeacherInvalidateScope | readonly TeacherInvalidateScope[]) => void;
}

export function useTeacherInvalidate(): TeacherInvalidator {
  const queryClient = useQueryClient();
  const run = (scope: TeacherInvalidateScope | readonly TeacherInvalidateScope[]) =>
    invalidateTeacherScope(queryClient, scope);
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
    modules: () => run("modules"),
    adm: () => run("adm"),
    anecdotal: () => run("anecdotal"),
    flags: () => run("flags"),
    sf10: () => run("sf10"),
    settings: () => run("settings"),
    scope: run,
  };
}
