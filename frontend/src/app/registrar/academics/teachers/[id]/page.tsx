"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  BookOpen,
  Layers,
  Briefcase,
  BookMarked,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTeacher, type TeacherDetail } from "../../api";

interface GroupedSubject {
  subjectId: string;
  code: string;
  name: string;
  gradeLevel: number;
  assignments: TeacherDetail["assignments"];
}

export default function TeacherWorkloadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = React.useMemo(() => decodeURIComponent(params.id), [params.id]);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [teacher, setTeacher] = React.useState<TeacherDetail | null>(null);

  React.useEffect(() => {
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch populates state
    setLoading(true);
    setError(null);
    fetchTeacher(id, ctrl.signal)
      .then((res) => setTeacher(res.teacher))
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setError(status === 404 ? "Teacher not found" : "Failed to load teacher workload.");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [id]);

  const initial = teacher?.name?.charAt(0)?.toUpperCase() ?? "?";
  const subjectCount = teacher?.assignments.length
    ? new Set(teacher.assignments.map((a) => a.subjectId)).size
    : 0;
  const sectionCount = teacher?.assignments.length
    ? new Set(teacher.assignments.map((a) => a.sectionId)).size
    : 0;
  const advisoryCount = teacher?.adviser.length ?? 0;
  const assignmentCount = teacher?.assignments.length ?? 0;

  const grouped = React.useMemo<GroupedSubject[]>(() => {
    if (!teacher) return [];
    const map = new Map<string, GroupedSubject>();
    for (const a of teacher.assignments) {
      const key = a.subjectId;
      if (!map.has(key)) {
        map.set(key, {
          subjectId: a.subjectId,
          code: a.code,
          name: a.name,
          gradeLevel: a.gradeLevel,
          assignments: [],
        });
      }
      map.get(key)!.assignments.push(a);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [teacher]);

  return (
    <section className="space-y-4 lg:space-y-6">
      {/* Title row — eyebrow on left, Back to table on right */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Teacher Workload
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => router.push("/registrar/academics")}
        >
          <ChevronLeft className="mr-1" aria-hidden />
          Back to table
        </Button>
      </div>

      {loading ? (
        <DetailSkeleton />
      ) : error || !teacher ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {error ?? "Teacher not found."}
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
          {/* ── Left column ─────────────────────────────────── */}
          <div className="space-y-4 lg:space-y-6 lg:col-span-2">
            {/* Hero banner */}
            <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-primary/5 to-muted flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {teacher.name}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  Subject workload &amp; class assignments
                </span>
                {assignmentCount > 0 && (
                  <Badge variant="default" className="rounded-4xl">
                    {assignmentCount} assignment{assignmentCount === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
            </div>

            {/* Teacher info card */}
            <Card className="bg-muted/40 ring-1 ring-foreground/10 gap-4 lg:gap-6">
              <CardContent className="flex items-center gap-4">
                <Avatar size="lg">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{teacher.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {subjectCount} subject{subjectCount === 1 ? "" : "s"} · {sectionCount} teaching
                    section{sectionCount === 1 ? "" : "s"}
                    {advisoryCount > 0 && (
                      <>
                        {" "}· {advisoryCount} advisory section
                        {advisoryCount === 1 ? "" : "s"}
                      </>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active school year workload within the registrar grade band.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Advisory Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Advisory Section</CardTitle>
                  <CardDescription>
                    The class this teacher advises, separate from the subjects they teach.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-4xl shrink-0">
                  {advisoryCount}
                </Badge>
              </CardHeader>
              <CardContent>
                {teacher.adviser.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Not assigned as an adviser this school year.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {teacher.adviser.map((adv) => (
                      <div
                        key={adv.id}
                        className="flex items-center gap-3 rounded-xl border p-4 bg-card"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <UserRound className="size-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{adv.name}</p>
                          <p className="text-xs text-muted-foreground">Grade {adv.gradeLevel}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[11px]">
                          Advising
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right sidebar (hidden on mobile) ──────────── */}
          <div className="hidden space-y-4 lg:space-y-6 lg:block">
            <Card className="bg-muted/40 ring-1 ring-foreground/10 gap-4 lg:gap-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="size-4 text-muted-foreground" aria-hidden />
                  Workload Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="m-4 lg:m-6 ring-1 ring-foreground/5 shadow-xs bg-card rounded-xl p-4 space-y-4">
                <SummaryRow
                  icon={<BookOpen className="size-4" aria-hidden />}
                  label="Subjects"
                  value={subjectCount}
                />
                <SummaryRow
                  icon={<Layers className="size-4" aria-hidden />}
                  label="Teaching sections"
                  value={sectionCount}
                />
                <SummaryRow
                  icon={<UserRound className="size-4" aria-hidden />}
                  label="Advisory sections"
                  value={advisoryCount}
                />
                <SummaryRow
                  icon={<Briefcase className="size-4" aria-hidden />}
                  label="Total assignments"
                  value={assignmentCount}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Subject Assignments (full width) ───────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Subject Assignments</h2>
              <p className="text-sm text-muted-foreground">
                The subjects this teacher handles and the sections they teach them in.
              </p>
            </div>
            <Badge variant="outline" className="rounded-4xl shrink-0">
              {grouped.length}
            </Badge>
          </div>

          {grouped.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <Briefcase className="size-8 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  No subject assignments yet for this teacher.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grouped.map((subject) => (
                <SubjectCard key={subject.subjectId} subject={subject} />
              ))}
            </div>
          )}
        </section>
        </>
      )}
    </section>
  );
}

function SubjectCard({ subject }: { subject: GroupedSubject }) {
  const uniqueSections = Array.from(new Set(subject.assignments.map((a) => a.section)));
  const terms = Array.from(new Set(subject.assignments.map((a) => a.term))).sort();

  return (
    <div className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
            <BookMarked className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{subject.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{subject.code}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 text-[11px] font-semibold">
          Grade {subject.gradeLevel}
        </Badge>
      </div>

      {/* Divider */}
      <div className="-mx-4 border-t" />

      {/* Sections taught */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Taught in
        </p>
        <div className="flex flex-wrap gap-1.5">
          {subject.assignments.map((a) => (
            <Badge
              key={a.id}
              variant="secondary"
              className="gap-1 px-2 py-0.5 text-[11px] font-medium"
            >
              {a.section}
              <span className="text-muted-foreground">·</span>
              T{a.term}
            </Badge>
          ))}
        </div>
      </div>

      {/* Footer stats */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Layers className="size-3.5" aria-hidden />
          {uniqueSections.length} section{uniqueSections.length === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Briefcase className="size-3.5" aria-hidden />
          {subject.assignments.length} assignment{subject.assignments.length === 1 ? "" : "s"}
          {terms.length > 0 && <> · Term{terms.length > 1 ? "s" : ""} {terms.join(", ")}</>}
        </span>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:space-y-6 lg:col-span-2">
        <Skeleton className="aspect-video rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <div className="hidden space-y-4 lg:space-y-6 lg:block">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
