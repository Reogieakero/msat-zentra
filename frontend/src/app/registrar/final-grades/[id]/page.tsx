"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  GraduationCap,
  Printer,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatSection } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";

interface SubjectRow {
  id: string;
  subject: string;
  teacher: string;
  computedAverage: number;
  transmutedGrade: number;
  remarks: string;
  status: "approved";
}

interface StudentRow {
  id: string;
  lrn: string;
  name: string;
  gradeLevel: string;
  section: string;
  term: string;
  overall: number;
  subjects: SubjectRow[];
  status: "approved";
}

interface GradesResponse {
  students: StudentRow[];
  total: number;
}

export default function FinalGradeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = React.useMemo(() => decodeURIComponent(params.id), [params.id]);

  const { data, isPending, isError } = useQuery({
    // Detail key: namespaced so it never collides with the paged list key
    // ["registrar-final-grades", page, q] (same endpoint, other params).
    queryKey: ["registrar-final-grades", "detail"],
    queryFn: () =>
      apiClient
        .get<GradesResponse>("/api/registrar/final-grades", {
          params: { pageSize: 100 },
        })
        .then((res) => res.data),
    staleTime: 30_000,
  });

  const student = React.useMemo(
    () => data?.students.find((s) => s.id === id),
    [data, id]
  );

  const [showFullAbout, setShowFullAbout] = React.useState(false);

  const initial = student?.name?.charAt(0)?.toUpperCase() ?? "?";
  const failedCount = student?.subjects.filter((s) => s.remarks === "Failed").length ?? 0;
  const totalSubjects = student?.subjects.length ?? 0;
  const milestones = [25, 50, 75, 100];

  const belowThresholdSubjects = React.useMemo(
    () => student?.subjects.filter((s) => s.transmutedGrade < 75) ?? [],
    [student]
  );
  const academicRisk = React.useMemo(() => {
    if (!student) return "Low";
    if (student.overall < 75) return "High";
    if (belowThresholdSubjects.length > 0) return "Moderate";
    return "Low";
  }, [student, belowThresholdSubjects]);

  const handlePrint = React.useCallback(() => {
    window.print();
  }, []);

  return (
    <section className="space-y-4 lg:space-y-6">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Final Grade Details
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => router.push("/registrar/final-grades")}
        >
          <ChevronLeft className="mr-1" aria-hidden />
          Back to table
        </Button>
      </div>

      {isPending ? (
        <DetailSkeleton />
      ) : isError || !student ? (
        <section className={assign.card} aria-label="Grade set not found">
          <span className={assign.glowClip} aria-hidden="true">
            <span className={assign.cardGlow} />
          </span>
          <div className="relative flex flex-col items-center justify-center gap-1.5 py-12 text-center">
            <span className="mb-1.5 inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
              <GraduationCap className="size-5" />
            </span>
            <p className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
              No complete grade set found
            </p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {isError
                ? "Could not load grade details."
                : "No complete grade set found for this student."}
            </p>
          </div>
        </section>
      ) : (
        <div className="grid items-start gap-4 lg:gap-6 lg:grid-cols-3">
          {/* ── Left column ─────────────────────────────────── */}
          <div className="space-y-4 lg:space-y-6 lg:col-span-2">
            {/* Hero banner */}
            <section className={assign.card} aria-label="Overall average">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex flex-col items-center gap-3 py-6 text-center">
                <span className="text-4xl font-bold tracking-tight text-foreground">
                  {student.overall}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  Overall Average
                </span>
                <Badge variant="default" className="rounded-4xl">
                  Complete
                </Badge>
              </div>
            </section>

            {/* Student info card */}
            <section className={assign.card} aria-label="Student information">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-4">
                <Avatar size="lg">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold">{student.name}</h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {student.gradeLevel} · {formatSection(student.section)} · {student.term}
                  </p>
                  <p className="font-mono text-sm text-muted-foreground">
                    {student.lrn}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <RiskBadge level={academicRisk} failedCount={failedCount} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Print grades" onClick={handlePrint}>
                    <Printer className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </section>

            {/* About This Grade Set */}
            <section>
              <h2 className="mb-3 text-base font-semibold">About This Grade Set</h2>
              <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                {showFullAbout
                  ? `This is the complete final grade set for ${student.name} (${student.term}). All ${totalSubjects} subject(s) — ${student.subjects.map((s) => s.subject).join(", ")} — have been locked by the subject teacher and approved by the class adviser. The grades below are now visible to the registrar for review.\n\nThe registrar has a view-only role in the grade pipeline. No further approval is required — these grades are finalized by the adviser once every subject in the student's term is approved.`
                  : `This is the complete final grade set for ${student.name} (${student.term}). All ${totalSubjects} subject(s) have been locked by the subject teacher and approved by the class adviser.`}
              </div>
              <button
                type="button"
                onClick={() => setShowFullAbout((v) => !v)}
                className="text-foreground hover:text-primary mt-2 inline-flex items-center gap-1 text-sm font-medium transition-colors"
              >
                {showFullAbout ? "Show less" : "Show more"}
                <ChevronDown
                  className={`size-4 transition-transform ${showFullAbout ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </section>

            {/* What This Means */}
            <section>
              <h2 className="mb-3 text-base font-semibold">What This Means</h2>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current" />
                  <span>All {totalSubjects} subject(s) are locked and adviser-approved for {student.term}.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current" />
                  <span>
                    {failedCount === 0
                      ? "The student passed all subjects with a transmuted grade of 75 or above."
                      : `${failedCount} subject(s) are below the passing grade of 75.`}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current" />
                  <span>The registrar is view-only — no further approval is required from this point.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current" />
                  <span>Grades are computed from written works, performance tasks, and Exams.</span>
                </li>
              </ul>
            </section>

            {/* Subject Grades table */}
            <section className={assign.card} aria-labelledby="subject-grades">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative">
                <h2 id="subject-grades" className="text-base font-semibold">
                  Subject Grades
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Per-subject breakdown with computed and transmuted grades.
                </p>
              </div>
              <div className="relative -mx-1 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Computed</TableHead>
                      <TableHead className="text-right">Transmuted</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {student.subjects.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <span className="font-medium text-foreground">{sub.subject}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{sub.teacher}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                          {sub.computedAverage}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium tabular-nums text-foreground">
                          {sub.transmutedGrade}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={sub.remarks === "Failed" ? "destructive" : "outline"}
                            className="text-[11px] font-semibold px-2 py-0.5"
                          >
                            {sub.remarks}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>

          {/* ── Right sidebar ──────────── */}
          <div className="space-y-4 lg:space-y-6">
            {/* Completion card */}
            <section className={assign.card} aria-label="Completion">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-2">
                <h2 className="text-base font-semibold">Completion</h2>
                <Badge variant="outline" className="rounded-4xl border px-2 py-0.5 text-xs font-medium ms-1">
                  {student.overall}%
                </Badge>
              </div>
              <div className="relative space-y-4 rounded-xl bg-card p-4 shadow-xs ring-1 ring-foreground/5">
                {/* Progress bar */}
                <div className="bg-primary/20 relative h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${Math.min(student.overall, 100)}%` }}
                  />
                </div>

                {/* Milestone circles */}
                <div className="flex items-center justify-between">
                  {milestones.map((m) => {
                    const reached = student.overall >= m;
                    return (
                      <span
                        key={m}
                        className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                          reached
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {m}
                      </span>
                    );
                  })}
                </div>

                {/* Follow-up note */}
                <div className="bg-muted/50 text-muted-foreground rounded-lg p-3 text-sm">
                  {failedCount === 0
                    ? `Great Job! ${student.name}'s final grades are complete and all subjects are passing. Ready for your review.`
                    : `${student.name} has ${failedCount} subject(s) below 75. Adviser follow-up may be needed.`}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:space-y-6 lg:col-span-2">
        <Skeleton className="aspect-video rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <div className="space-y-4 lg:space-y-6">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

function RiskBadge({
  level,
  failedCount,
}: {
  level: "Low" | "Moderate" | "High";
  failedCount: number;
}) {
  if (level === "Low") {
    return (
      <Badge
        variant="outline"
        className="rounded-4xl border-border bg-transparent text-muted-foreground text-xs font-semibold"
      >
        <Check className="mr-1 size-3.5" aria-hidden />
        Not at risk
      </Badge>
    );
  }

  const high = level === "High";
  return (
    <Badge
      variant="outline"
      className={`rounded-4xl text-xs font-semibold ${
        high
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-muted text-foreground"
      }`}
    >
      <AlertTriangle className="mr-1 size-3.5" aria-hidden />
      At risk · {level} · {failedCount} below 75
    </Badge>
  );
}
