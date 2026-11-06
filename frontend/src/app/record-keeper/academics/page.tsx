"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/ui/kanban-board";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatGrade } from "@/lib/utils";
import { fetchRecordKeeperSubjects } from "@/services/registry/academics.service";
import { RecordKeeperEmptyState } from "../components/RecordKeeperEmptyCard";
import styles from "./academics.module.css";

const GRADE_FILTERS = [7, 8, 9, 10] as const;
type GradeFilter = (typeof GRADE_FILTERS)[number];

const QUERY_KEY = ["record-keeper-subjects"];

export default function RecordKeeperSubjectsPage() {
  return (
    <React.Suspense>
      <RecordKeeperSubjectsPageInner />
    </React.Suspense>
  );
}

function RecordKeeperSubjectsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialGrade = Number(searchParams.get("grade"));
  const [grade, setGrade] = React.useState<GradeFilter | null>(
    GRADE_FILTERS.includes(initialGrade as GradeFilter) ? (initialGrade as GradeFilter) : null,
  );

  // Keep the grade filter in the URL so refresh and back/forward land on the
  // same view (same convention as the other list pages).
  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (grade === null) params.delete("grade");
    else params.set("grade", String(grade));
    const next = params.toString();
    if (next !== searchParams.toString()) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [grade, pathname, router, searchParams]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => fetchRecordKeeperSubjects(signal),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const subjects = React.useMemo(() => data ?? [], [data]);

  const filtered = React.useMemo(
    () => subjects.filter((s) => grade === null || s.gradeLevel === grade),
    [subjects, grade],
  );

  const gradeTabs = (
    <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Filter by grade">
      {[null, ...GRADE_FILTERS].map((g) => {
        const active = grade === g;
        return (
          <button
            key={g ?? "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setGrade(g)}
            className="inline-flex cursor-pointer rounded-md p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Pill tone={active ? "blue" : "neutral"}>
              {g === null ? "All" : formatGrade(String(g))}
            </Pill>
          </button>
        );
      })}
    </div>
  );

  return (
    <section className="flex min-w-0 flex-col gap-4 font-sans">
      <KanbanBoard
        title="Subjects"
        icon={<BookOpen size={14} className="text-amber-500" aria-hidden />}
        ariaLabel="Subjects"
        className={styles.boardIn}
        description="Grades 7–10 subject catalog for this desk — code, learning area, category, and enrolled count."
        headerCenter={gradeTabs}
      >
        {isPending ? (
          <div className="flex flex-col gap-2 p-1" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex min-h-24 flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="text-xs text-muted-foreground">Could not load subjects.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs font-medium text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
            >
              Try again
            </button>
          </div>
        ) : subjects.length === 0 ? (
          <RecordKeeperEmptyState
            icon={BookOpen}
            title="No subjects yet"
            hint="Subjects appear here once they are added for grades 7–10."
          />
        ) : filtered.length === 0 ? (
          <p className="flex min-h-24 items-center justify-center px-1 py-8 text-center text-xs text-muted-foreground">
            No subjects for the selected grade.
          </p>
        ) : (
          <div className="px-0.5 pb-0.5">
            <Table className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Learning area</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Enrolled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s, index) => (
                  <TableRow
                    key={s.id}
                    style={{ animationDelay: `${450 + Math.min(index, 11) * 140}ms` }}
                  >
                    <TableCell>
                      <Pill tone="green" label="Subject code">
                        {s.code}
                      </Pill>
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Pill tone="blue" label="Grade level">
                        {formatGrade(String(s.gradeLevel))}
                      </Pill>
                    </TableCell>
                    <TableCell>
                      <Pill tone="amber" label="Category">
                        {s.category}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.enrolled}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </KanbanBoard>
    </section>
  );
}
