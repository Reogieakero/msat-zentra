"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { cn } from "@/lib/utils";
import { useTerm } from "@/lib/term/TermContext";

interface MatrixSubject {
  id: string;
  name: string;
  code: string;
}

interface MatrixStudent {
  studentId: string;
  name: string;
  lrn: string;
  rates: Record<string, number | null>;
}

function rateClass(rate: number | null): string {
  if (rate === null) return "text-muted-foreground";
  if (rate >= 0.9) return "text-green-600 dark:text-green-500";
  if (rate >= 0.75) return "text-amber-600 dark:text-amber-500";
  return "text-red-600 dark:text-red-500";
}

function rateRing(rate: number): string {
  if (rate >= 0.9) return "ring-green-500";
  if (rate >= 0.75) return "ring-amber-500";
  return "ring-red-500";
}

function rateWash(rate: number): { from: string; to: string } {
  if (rate >= 0.9) return { from: "#22c55e", to: "#16a34a" };
  if (rate >= 0.75) return { from: "#f59e0b", to: "#d9770f" };
  return { from: "#ef4444", to: "#dc2626" };
}

function rateBar(rate: number): string {
  if (rate >= 0.9) return "bg-green-500";
  if (rate >= 0.75) return "bg-amber-500";
  return "bg-red-500";
}

function studentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "?";
  const second =
    parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

function overallRate(rates: Record<string, number | null>, subjectCount: number): number {
  if (subjectCount === 0) return 0;
  const sum: number = Object.values(rates).reduce<number>(
    (total, r) => total + (r ?? 0),
    0,
  );
  return sum / subjectCount;
}

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
export function AdvisoryAttendanceList({
  sectionId,
  filter,
  selectedId,
  onSelect,
}: {
  sectionId: string;
  filter: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const matrixQuery = useQuery({
    queryKey: ["attendance-section-matrix", sectionId, termKey],
    queryFn: async () => {
      const params = new URLSearchParams({ sectionId });
      const { data } = await apiClient.get<{
        sectionId: string;
        sectionName: string;
        termId: string;
        subjects: MatrixSubject[];
        students: MatrixStudent[];
      }>(`/api/attendance/section-subject-matrix?${params.toString()}`);
      return data;
    },
    retry: false,
  });

  const subjects = React.useMemo(() => matrixQuery.data?.subjects ?? [], [matrixQuery.data]);
  const students = React.useMemo(() => matrixQuery.data?.students ?? [], [matrixQuery.data]);

  const selected = selectedId
    ? (students.find((s) => s.studentId === selectedId) ?? null)
    : null;
  const selectedAvg = selected ? overallRate(selected.rates, subjects.length) : 0;
  const setSelectedId = onSelect;

  const rows = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    const withAvg = students.map((s) => ({ student: s, avg: overallRate(s.rates, subjects.length) }));
    const filtered = q
      ? withAvg.filter(
          ({ student }) =>
            student.name.toLowerCase().includes(q) || student.lrn.toLowerCase().includes(q),
        )
      : withAvg;
    return [...filtered].sort((a, b) => a.avg - b.avg);
  }, [students, subjects.length, filter]);

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
      <div
        className={`grid items-start gap-4 transition-[grid-template-columns] duration-300 ease-out motion-reduce:transition-none ${
          selected ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : "lg:grid-cols-[minmax(0,1fr)_0rem]"
        }`}
      >
        <div className="min-w-0">
      {matrixQuery.isPending ? (
        <ul className={GRID} aria-busy="true" aria-label="Loading attendance">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i} className={assign.skelRowGrid} aria-hidden="true">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
                <div className="h-6 w-12 shrink-0 rounded bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      ) : matrixQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load advisory attendance.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {students.length === 0
            ? "No students in this section yet."
            : "No students match your search."}
        </p>
      ) : (
        <ul className={GRID} aria-label="Student attendance">
          {rows.map(({ student, avg }) => {
            const isSelected = selectedId === student.studentId;
            const wash = rateWash(avg);
            return (
              <li key={student.studentId} className="min-w-0">
                <Attachment
                  state="done"
                  className={cn(assign.card, "w-full max-w-none", isSelected && `ring-2 ${rateRing(avg)}`)}
                  style={
                    isSelected
                      ? {
                          borderColor: `color-mix(in oklch, ${wash.from} 45%, transparent)`,
                          background: `linear-gradient(135deg, color-mix(in oklch, ${wash.from} 26%, var(--card)), color-mix(in oklch, ${wash.to} 18%, var(--card)))`,
                        }
                      : undefined
                  }
                >
                  <span className={assign.glowClip} aria-hidden="true">
                    <span className={assign.cardGlow} />
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(student.studentId)}
                    aria-label={`${student.name}, average attendance ${Math.round(avg * 100)} percent — open subject breakdown`}
                    className="relative flex w-full min-w-0 cursor-pointer flex-col items-center gap-1 text-center"
                  >
                    <AttachmentMedia
                      variant="icon"
                      className="h-14 w-14 bg-primary/10 text-lg font-semibold text-primary"
                      aria-hidden="true"
                    >
                      {studentInitials(student.name)}
                    </AttachmentMedia>
                    <AttachmentContent className="flex w-full min-w-0 flex-col items-center">
                      <AttachmentTitle>{student.name}</AttachmentTitle>
                      <AttachmentDescription>{student.lrn}</AttachmentDescription>
                    </AttachmentContent>
                    <span
                      className={cn(
                        "shrink-0 text-lg font-semibold tabular-nums",
                        rateClass(avg),
                      )}
                    >
                      {`${Math.round(avg * 100)}%`}
                    </span>
                  </button>
                  <div className="relative flex w-full min-w-0 basis-full justify-end">
                    <span className="text-xs text-muted-foreground italic">
                      average of {subjects.length} subject{subjects.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </Attachment>
              </li>
            );
          })}
        </ul>
      )}
        </div>
        <div className={`min-w-0 ${selected ? "" : "overflow-hidden"}`} inert={!selected}>
          <div
            className={`flex w-full max-w-full flex-col gap-4 self-start transition-all duration-300 ease-out motion-reduce:transition-none lg:fixed lg:top-16 lg:right-4 lg:bottom-4 lg:w-[20rem] lg:max-w-[20rem] lg:overflow-y-auto ${
              selected ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
            }`}
          >
            {selected ? (
              <div className={assign.card} aria-label={`${selected.name} subject attendance`}>
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className="relative flex flex-col items-center gap-1 text-center">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label="Close subject breakdown"
                    className="absolute top-0 right-0 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary"
                    aria-hidden="true"
                  >
                    {studentInitials(selected.name)}
                  </span>
                  <h3 className="w-full truncate font-semibold">{selected.name}</h3>
                  <p className="w-full truncate text-xs text-muted-foreground">
                    {selected.lrn} · average of {subjects.length} subject
                    {subjects.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="relative flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Present average per subject
                  </span>
                  <span className={cn("text-2xl font-semibold tabular-nums", rateClass(selectedAvg))}>
                    {`${Math.round(selectedAvg * 100)}%`}
                  </span>
                </div>
                <div className="relative flex flex-col gap-3">
                  {subjects.map((s) => {
                    const rate = selected.rates[s.id] ?? 0;
                    const pct = Math.round(rate * 100);
                    return (
                      <div key={s.id} className="flex min-w-0 flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-sm">
                            <span className="font-medium">{s.code}</span>
                            <span className="text-muted-foreground"> · {s.name}</span>
                          </span>
                          <span
                            className={cn("shrink-0 text-sm font-semibold tabular-nums", rateClass(rate))}
                          >
                            {`${pct}%`}
                          </span>
                        </div>
                        <div
                          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${s.name} present average`}
                        >
                          <div className={cn("h-full rounded-full", rateBar(rate))} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
