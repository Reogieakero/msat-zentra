"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Printer,
  Share2,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatSection } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface SubjectRow {
  id: string;
  subject: string;
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

  const { data, isPending } = useQuery({
    queryKey: ["registrar-final-grades"],
    queryFn: () =>
      apiClient
        .get<GradesResponse>("/api/registrar/final-grades", {
          params: { pageSize: 100 },
        })
        .then((res) => res.data),
  });

  const student = React.useMemo(
    () => data?.students.find((s) => s.id === id),
    [data, id]
  );

  const [showFullAbout, setShowFullAbout] = React.useState(false);

  const initial = student?.name?.charAt(0)?.toUpperCase() ?? "?";
  const passedCount = student?.subjects.filter((s) => s.remarks === "Passed").length ?? 0;
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
      ) : !student ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No complete grade set found for this student.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
          {/* ── Left column ─────────────────────────────────── */}
          <div className="space-y-4 lg:space-y-6 lg:col-span-2">
            {/* Hero banner (replaces course video) */}
            <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/5 to-muted flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
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
            </div>

            {/* Student info card (replaces mentor card) */}
            <Card className="bg-muted/40 ring-1 ring-foreground/10 gap-4 lg:gap-6">
              <CardContent className="flex items-center gap-4">
                <Avatar size="lg">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{student.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {student.gradeLevel} · {formatSection(student.section)} · {student.term}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {student.lrn}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <RiskBadge level={academicRisk} failedCount={failedCount} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Print grades">
                    <Printer className="size-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Share">
                    <Share2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* About This Grade Set */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">About This Grade Set</h2>
              <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
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

            {/* What This Means (replaces "This Course Suit For") */}
            <section>
              <h2 className="mb-3 text-lg font-semibold">What This Means</h2>
              <ul className="text-muted-foreground space-y-2">
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
                  <span>Grades are computed from written works, performance tasks, and quarterly exams.</span>
                </li>
              </ul>
            </section>

            {/* Subject Grades table */}
            <Card>
              <CardHeader>
                <CardTitle>Subject Grades</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 first:rounded-tl-lg last:rounded-tr-lg">
                        Subject
                      </th>
                      <th className="h-11 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">
                        Computed Avg
                      </th>
                      <th className="h-11 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">
                        Transmuted
                      </th>
                      <th className="h-11 px-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.subjects.map((sub) => (
                      <tr
                        key={sub.id}
                        className="border-t transition-colors hover:bg-muted/30"
                      >
                        <td className="p-4 font-medium">{sub.subject}</td>
                        <td className="p-4 text-center font-mono tabular-nums">
                          {sub.computedAverage}
                        </td>
                        <td className="p-4 text-center font-mono tabular-nums">
                          {sub.transmutedGrade}
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={
                              sub.remarks === "Failed" ? "destructive" : "outline"
                            }
                            className="text-xs font-semibold"
                          >
                            {sub.remarks}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* ── Right sidebar (hidden on mobile) ──────────── */}
          <div className="hidden space-y-4 lg:space-y-6 lg:block">
            {/* Overall Average card (replaces Your Study Progress) */}
            <Card className="bg-muted/40 ring-1 ring-foreground/10 gap-4 lg:gap-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  Your Study Progress
                  <Badge variant="outline" className="rounded-4xl border px-2 py-0.5 text-xs font-medium ms-1">
                    {student.overall}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="m-4 lg:m-6 ring-1 ring-foreground/5 shadow-xs bg-card rounded-xl p-4 space-y-4">
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

                {/* Encouragement note */}
                <div className="bg-muted/50 text-muted-foreground rounded-lg p-3 text-sm">
                  {failedCount === 0
                    ? `Great Job! ${student.name}'s final grades are complete and all subjects are passing. Ready for your review.`
                    : `${student.name} has ${failedCount} subject(s) below 75. Adviser follow-up may be needed.`}
                </div>
              </CardContent>
            </Card>

            {/* Subject Grades module list (replaces Course Completion) */}
            <Card>
              <CardHeader>
                <CardTitle>Subject Grades</CardTitle>
                <CardAction>
                  <span className="text-muted-foreground text-sm">
                    {passedCount}/{totalSubjects}
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-2">
                {student.subjects.map((sub) => {
                  const passed = sub.remarks === "Passed";
                  return (
                    <div
                      key={sub.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                        passed
                          ? "border-green-500/20 bg-green-500/5"
                          : "border-destructive/20 bg-destructive/5"
                      }`}
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                          passed
                            ? "bg-green-500 text-white"
                            : "bg-destructive text-white"
                        }`}
                      >
                        {passed ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <X className="size-4" aria-hidden />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{sub.subject}</p>
                        <p className="text-muted-foreground text-sm font-mono tabular-nums">
                          {sub.transmutedGrade}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
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
      <div className="hidden space-y-4 lg:space-y-6 lg:block">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
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
        className="rounded-4xl border-green-500/30 bg-green-500/10 text-green-600 text-xs font-semibold"
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
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600"
      }`}
    >
      <AlertTriangle className="mr-1 size-3.5" aria-hidden />
      At risk · {level} · {failedCount} below 75
    </Badge>
  );
}