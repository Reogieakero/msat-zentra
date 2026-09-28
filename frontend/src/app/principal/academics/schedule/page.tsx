"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ClipboardCheck, Clock, Inbox, Info } from "lucide-react";
import { apiClient } from "@/lib/api/client";
// Section cards share one component with the teacher schedule grid —
// teacher/schedule and principal/academics/schedule render the identical
// design from `SectionScheduleCard`.
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import {
  sectionCardStatus,
  SectionScheduleCard,
} from "@/components/schedule/SectionScheduleCard";

interface SubmissionEntry {
  day: number;
  period: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  subject: { id: string; name: string; code: string };
  teacherName: { id: string; name: string } | null;
  submittedAt: string | null;
  submitter: { fullName: string } | null;
}

interface Submission {
  id: string;
  name: string;
  gradeLevel: string;
  adviser: { fullName: string } | null;
  timetableEntries: SubmissionEntry[];
}

function statusHint(s: Submission): string {
  const status = sectionCardStatus(s.timetableEntries);
  if (status === "submitted") {
    const n = s.timetableEntries.filter((e) => e.status === "SUBMITTED").length;
    return `${n} slot${n === 1 ? "" : "s"} awaiting review — tap to view`;
  }
  if (status === "empty") return "No schedule yet — tap to view";
  const n = s.timetableEntries.length;
  const label = status === "approved" ? "Approved" : status === "returned" ? "Returned" : "Draft";
  return `${n} slot${n === 1 ? "" : "s"} · ${label} — tap to view`;
}

// Section grid — the shared `SectionScheduleCard`, one design with the
// teacher workspace. Each card links to its own review page at
// /principal/academics/schedule/[sectionId], mirroring
// teacher/schedule → teacher/schedule/[sectionId]. Every grades 7–10
// section always shows a card, whatever its schedule status.
export default function PrincipalSchedulePage() {
  const sectionsQuery = useQuery<{ sections: Submission[] }>({
    queryKey: ["principal-schedule-sections"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sections: Submission[] }>(
        "/api/academics/schedule/sections",
      );
      return data;
    },
  });

  const sections = sectionsQuery.data?.sections ?? [];
  // Same ordering as the teacher workspace: grade, then name.
  const gradeNumber = (g: string) => Number(g.replace("G", "")) || 0;
  const orderedSections = [...sections].sort(
    (a, b) => gradeNumber(a.gradeLevel) - gradeNumber(b.gradeLevel) || a.name.localeCompare(b.name),
  );
  const awaitingTotal = sections.reduce(
    (n, s) => n + s.timetableEntries.filter((e) => e.status === "SUBMITTED").length,
    0,
  );

  // Rail status — the section/slot counts live here, same rail pattern as
  // the teacher schedule workspace.
  const railVariant = awaitingTotal > 0 ? "blue" : sections.length > 0 ? "green" : "gray";
  const railMeta = {
    blue: {
      title: "Awaiting review",
      message: `${sections.length} section${sections.length === 1 ? "" : "s"} · ${awaitingTotal} slot${awaitingTotal === 1 ? "" : "s"}.`,
      from: "#3b82f6",
      to: "#2563d1",
      chip: "bg-blue-500/15",
      icon: "text-blue-500",
      Icon: Clock,
    },
    green: {
      title: "All reviewed",
      message: "Nothing awaiting review.",
      from: "#22c55e",
      to: "#16a34a",
      chip: "bg-green-500/15",
      icon: "text-green-500",
      Icon: Check,
    },
    gray: {
      title: "No sections",
      message: "Sections for grades 7–10 will appear here.",
      from: "#9ca3af",
      to: "#6b7280",
      chip: "bg-gray-500/15",
      icon: "text-gray-500",
      Icon: Inbox,
    },
  }[railVariant];
  const RailIcon = railMeta.Icon;

  return (
    <section className="flex w-full flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule Approval</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Timetables sent by the master teacher appear here for review.
        </p>
      </div>

      {sectionsQuery.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading sections">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-input bg-card p-5">
              <div className="h-5 w-48 rounded bg-muted" />
              <div className="mt-2 h-4 w-72 rounded bg-muted" />
              <div className="mt-4 h-32 rounded-lg bg-muted/60" />
            </div>
          ))}
        </div>
      ) : sectionsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load sections.
        </p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0">
            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card p-12 text-center">
                <ClipboardCheck size={40} className="mb-4 text-muted-foreground" aria-hidden />
                <h3 className="text-lg font-semibold">No sections yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sections for grades 7–10 will appear here.
                </p>
              </div>
            ) : (
              <div className={assign.grid} role="group" aria-label="Sections">
                {orderedSections.map((s) => {
                  const hint = statusHint(s);
                  return (
                    <SectionScheduleCard
                      key={s.id}
                      href={`/principal/academics/schedule/${s.id}`}
                      ariaLabel={`Open schedule for ${s.name} — ${hint}`}
                      gradeLevel={s.gradeLevel}
                      sectionName={s.name}
                      adviserName={s.adviser?.fullName ?? null}
                      timetableEntries={s.timetableEntries}
                      hint={hint}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <div
              className={assign.card}
              role="status"
              aria-label={`Schedule status: ${railMeta.title} — ${railMeta.message}`}
              style={{
                borderColor: `color-mix(in oklch, ${railMeta.from} 45%, transparent)`,
                background: `linear-gradient(135deg, color-mix(in oklch, ${railMeta.from} 26%, var(--card)), color-mix(in oklch, ${railMeta.to} 18%, var(--card)))`,
              }}
            >
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${railMeta.chip}`}
                  aria-hidden="true"
                >
                  <RailIcon size={20} className={railMeta.icon} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">{railMeta.title}</h3>
                  <p className="text-xs text-muted-foreground">{railMeta.message}</p>
                </div>
              </div>
            </div>

            <div className={assign.card} aria-label="Section status legend">
              <span className={assign.glowClip} aria-hidden="true">
                <span className={assign.cardGlow} />
              </span>
              <div className="relative flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10"
                  aria-hidden="true"
                >
                  <Info size={20} className="text-primary" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">Legend</h3>
                  <p className="text-xs text-muted-foreground">
                    What each card dot means.
                  </p>
                </div>
              </div>
              <div className="relative flex flex-col gap-1.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
                  Submitted — awaiting review
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
                  Approved — official
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
                  Draft — not yet submitted
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-gray-500" aria-hidden />
                  Empty — no schedule yet
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
