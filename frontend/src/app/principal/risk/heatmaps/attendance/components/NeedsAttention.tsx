"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./NeedsAttention.module.css";

type Session = "AM" | "PM";

interface AtRiskStudent {
  id: string;
  lrn: string;
  name: string;
  sectionId: string;
  section: string;
  gradeLevel: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
  hasAccount: boolean;
}

export function NeedsAttention({
  session,
  onSessionChange,
}: {
  session: Session;
  onSessionChange: (s: Session) => void;
}) {
  const [expandedGrade, setExpandedGrade] = React.useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["attendance-needs-attention", session],
    queryFn: async () => {
      const res = await apiClient.get<{
        students: AtRiskStudent[];
        schoolDays: number;
        term?: { id: string; termNumber: number };
      }>("/api/attendance/at-risk-students", { params: { session } });
      return res.data;
    },
    staleTime: 30_000,
  });

  // Grouped by grade, worst grade first (by lowest student rate). Clicking
  // a grade row expands its student list.
  const allStudents = React.useMemo(() => data?.students ?? [], [data]);
  const termNumber = data?.term?.termNumber;
  const gradeGroups = React.useMemo(() => {
    const map = new Map<string, AtRiskStudent[]>();
    for (const s of allStudents) {
      const arr = map.get(s.gradeLevel) ?? [];
      arr.push(s);
      map.set(s.gradeLevel, arr);
    }
    return [...map.entries()]
      .map(([grade, list]) => ({
        grade,
        students: list.sort((a, b) => a.rate - b.rate),
      }))
      .sort((a, b) => {
        const worst =
          (a.students[0]?.rate ?? 100) - (b.students[0]?.rate ?? 100);
        if (worst !== 0) return worst;
        return Number(a.grade) - Number(b.grade);
      });
  }, [allStudents]);

  return (
    <div className={styles.content}>
      <div className={styles.toolbar}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Needs Attention</h1>
          <p className={styles.subtitle}>
            Students under 80% of current attendance — {session} session
            {termNumber ? ` · Term ${termNumber}` : ""},{" "}
            {data?.schoolDays ?? 0} school days.
          </p>
        </div>
        <div className={styles.toolbarRight}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Session filter"
              >
                {session} session
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["AM", "PM"] as Session[]).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onSessionChange(s)}>
                  {session === s ? (
                    <Check aria-hidden />
                  ) : (
                    <span className={styles.checkSpacer} />
                  )}
                  <span>{s} session</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isPending ? (
        <>
          <Skeleton className={styles.skelRow} />
          <Skeleton className={styles.skelRow} />
          <Skeleton className={styles.skelRow} />
        </>
      ) : gradeGroups.length === 0 ? (
        <p className={styles.empty}>
          <TriangleAlert className={styles.emptyIcon} aria-hidden />
          No students under 80% — nothing needs attention.
        </p>
      ) : (
        <ul className={styles.grades}>
          {gradeGroups.map((g) => {
            const open = expandedGrade === g.grade;
            const worst = g.students[0]?.rate ?? 100;
            return (
              <li key={g.grade} className={styles.grade}>
                <button
                  type="button"
                  className={styles.gradeBtn}
                  onClick={() => setExpandedGrade(open ? null : g.grade)}
                  aria-expanded={open}
                >
                  {open ? (
                    <ChevronDown className={styles.chev} aria-hidden />
                  ) : (
                    <ChevronRight className={styles.chev} aria-hidden />
                  )}
                  <span
                    className={styles.dot}
                    data-sev={worst < 50 ? "bad" : "warn"}
                    aria-hidden
                  />
                  <span className={styles.gradeIdentity}>
                    <span className={styles.gradeName}>Grade {g.grade}</span>
                    <span className={styles.gradeMeta}>
                      {g.students.length} student{g.students.length === 1 ? "" : "s"} below 80%
                    </span>
                  </span>
                </button>
                <div
                  className={styles.expandable}
                  data-open={open ? true : undefined}
                >
                  <ul className={styles.students}>
                    {g.students.map((s) => (
                      <li key={s.id} className={styles.student}>
                        <span
                          className={styles.dot}
                          data-sev={s.rate < 50 ? "bad" : "warn"}
                          aria-hidden
                        />
                        <span className={styles.studentIdentity}>
                          <span className={styles.studentName}>{s.name}</span>
                          <span className={styles.studentLrn}>
                            {s.lrn} · {s.section}
                          </span>
                        </span>
                        <span className={styles.studentCounts}>
                          {s.present} pres · {s.late} late · {s.absent} abs ·{" "}
                          {s.excused} exc
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
