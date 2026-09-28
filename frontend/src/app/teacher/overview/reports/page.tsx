"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check, Clock } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import { TeacherCodeClaim } from "@/components/schedule/TeacherCodeClaim";

interface LinkedName {
  id: string;
  name: string;
  code: string | null;
}

interface ReportSlot {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  section: { id: string; name: string; gradeLevel: string };
}

/* Teaching-load report for the active term, resolved from the teacher's
   linked timetable slots: totals by status plus a per-section breakdown. */
export default function TeacherReportsPage() {
  const meQuery = useQuery<{ teacherName: LinkedName | null }>({
    queryKey: ["teacher-schedule-me"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ teacherName: LinkedName | null }>(
        "/api/teacher/schedule/teachers/me",
      );
      return data;
    },
  });
  const linked = meQuery.data?.teacherName ?? null;

  const slotsQuery = useQuery<{ slots: ReportSlot[] }>({
    queryKey: ["teacher-my-slots"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ slots: ReportSlot[] }>(
        "/api/teacher/schedule/my-slots",
      );
      return data;
    },
    enabled: linked !== null,
  });

  if (meQuery.isPending) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground" aria-busy="true">
            Loading report…
          </p>
        </div>
      </section>
    );
  }

  if (!linked) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Link your teacher code to see your teaching load.
          </p>
        </div>
        <TeacherCodeClaim
          title="Link your teacher code"
          description="Enter the code next to your name in the master teacher's teacher list (e.g. MS-101). Your per-section teaching load will report here."
        />
      </section>
    );
  }

  const slots = slotsQuery.data?.slots ?? [];
  const approved = slots.filter((s) => s.status === "APPROVED").length;
  const submitted = slots.filter((s) => s.status === "SUBMITTED").length;

  const bySection = new Map<
    string,
    {
      section: { id: string; name: string; gradeLevel: string };
      subjects: Map<string, { name: string; code: string; approved: number; submitted: number }>;
    }
  >();
  const ordered = [...slots].sort((a, b) =>
    a.section.name.localeCompare(b.section.name),
  );
  for (const s of ordered) {
    let entry = bySection.get(s.section.id);
    if (!entry) {
      entry = { section: s.section, subjects: new Map() };
      bySection.set(s.section.id, entry);
    }
    const sub = entry.subjects.get(s.subject.id) ?? {
      name: s.subject.name,
      code: s.subject.code,
      approved: 0,
      submitted: 0,
    };
    if (s.status === "APPROVED") sub.approved += 1;
    else sub.submitted += 1;
    entry.subjects.set(s.subject.id, sub);
  }

  const stats = [
    {
      title: "Total slots",
      value: slots.length,
      hint: "Committed timetable slots this term.",
      from: "#3b82f6",
      to: "#2563d1",
      chip: "bg-blue-500/15",
      icon: "text-blue-500",
      Icon: BookOpen,
    },
    {
      title: "Approved",
      value: approved,
      hint: "Official slots.",
      from: "#22c55e",
      to: "#16a34a",
      chip: "bg-green-500/15",
      icon: "text-green-500",
      Icon: Check,
    },
    {
      title: "Awaiting review",
      value: submitted,
      hint: "Submitted, not yet approved.",
      from: "#eab308",
      to: "#ca8a04",
      chip: "bg-yellow-500/15",
      icon: "text-yellow-500",
      Icon: Clock,
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {linked.name}
          {linked.code ? ` (${linked.code})` : ""} · Teaching load for the active term.
        </p>
      </div>

      {slotsQuery.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading report">
          <div className="h-24 rounded-xl border border-input bg-card" />
          <div className="h-48 rounded-xl border border-input bg-card" />
        </div>
      ) : slotsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load your report.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.title}
                className={assign.card}
                role="status"
                aria-label={`${s.title}: ${s.value} — ${s.hint}`}
                style={{
                  borderColor: `color-mix(in oklch, ${s.from} 45%, transparent)`,
                  background: `linear-gradient(135deg, color-mix(in oklch, ${s.from} 26%, var(--card)), color-mix(in oklch, ${s.to} 18%, var(--card)))`,
                }}
              >
                <span className={assign.glowClip} aria-hidden="true">
                  <span className={assign.cardGlow} />
                </span>
                <div className="relative flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${s.chip}`}
                    aria-hidden="true"
                  >
                    <s.Icon size={20} className={s.icon} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                    <h3 className="text-sm font-semibold">{s.title}</h3>
                    <p className="text-xs text-muted-foreground">{s.hint}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={assign.card} aria-label="Load by section">
            <span className={assign.glowClip} aria-hidden="true">
              <span className={assign.cardGlow} />
            </span>
            <div className="relative flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
                aria-hidden="true"
              >
                <BookOpen size={20} className="text-primary" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">Load by section</h3>
                <p className="text-xs text-muted-foreground">
                  Subjects and slot counts per section.
                </p>
              </div>
            </div>
            <div className="relative flex flex-col gap-3">
              {bySection.size === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No committed slots yet — your load appears here once the master
                  teacher schedules {linked.name}.
                </p>
              ) : (
                [...bySection.values()].map((entry) => (
                  <div key={entry.section.id} className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm font-semibold">
                      {entry.section.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        · Grade {entry.section.gradeLevel.replace("G", "")}
                      </span>
                    </p>
                    {[...entry.subjects.values()].map((sub) => (
                      <p key={sub.name} className="truncate text-sm text-muted-foreground">
                        {sub.name} ({sub.code}) · {sub.approved + sub.submitted} slot
                        {sub.approved + sub.submitted === 1 ? "" : "s"} · {sub.approved} approved ·{" "}
                        {sub.submitted} awaiting review
                      </p>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
