"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTerm } from "@/lib/term/TermContext";
import assign from "@/app/principal/academics/assign/components/section-assignments.module.css";
import type { ScheduleSubject } from "../page";

export type CopiedSlot = {
  subjectId: string;
  teacherNameId: string;
};

type Props = {
  copied: CopiedSlot;
  onClear: () => void;
};

// Copied-slot indicator: same grid-card shell as the assign grid (glow,
// hover, radius) with an amber alert identity — amber-tinted border via
// inline style so it survives the card hover state, amber icon circle.
export function CopiedSlotCard({ copied, onClear }: Props) {
  const { activeTerm } = useTerm();
  const termKey = `${activeTerm?.schoolYearId ?? ""}:${activeTerm?.termId ?? ""}`;
  const subjectsQuery = useQuery<{ subjects: ScheduleSubject[] }>({
    queryKey: ["teacher-schedule-subjects", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ subjects: ScheduleSubject[] }>(
        "/api/teacher/schedule/subjects",
      );
      return data;
    },
  });
  const teachersQuery = useQuery<{ teachers: { id: string; name: string }[] }>({
    queryKey: ["teacher-schedule-teachers", termKey],
    queryFn: async () => {
      const { data } = await apiClient.get<{ teachers: { id: string; name: string }[] }>(
        "/api/teacher/schedule/teachers",
      );
      return data;
    },
  });

  const sub = (subjectsQuery.data?.subjects ?? []).find((s) => s.id === copied.subjectId);
  const teacher = (teachersQuery.data?.teachers ?? []).find((t) => t.id === copied.teacherNameId);

  return (
    <div
      className={assign.card}
      style={{
        borderColor: "color-mix(in oklch, #f59e0b 45%, transparent)",
        background:
          "linear-gradient(135deg, color-mix(in oklch, #f59e0b 26%, var(--card)), color-mix(in oklch, #ea580c 18%, var(--card)))",
      }}
      role="status"
      aria-label={`Copied ${sub?.name ?? "subject"} with ${teacher?.name ?? "teacher"} — tap an empty slot to paste`}
    >
      <span className={assign.glowClip} aria-hidden="true">
        <span className={assign.cardGlow} />
      </span>
      <div className="relative flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500/15"
          aria-hidden="true"
        >
          <Copy size={20} className="text-orange-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Ready to paste</p>
          <p className="truncate text-xs text-muted-foreground">
            {sub?.name ?? "…"} with {teacher?.name ?? "…"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear copied slot"
          title="Clear copied slot"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <p className="relative text-xs text-muted-foreground">Tap an empty slot to paste.</p>
    </div>
  );
}
