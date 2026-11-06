"use client";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { CardModal } from "@/components/ui/CardModal";
import styles from "../schedule-empty.module.css";
import type { ScheduleSubject } from "../page";
function categoryLabel(category: string): string {
  return category === "ELECTIVE" ? "Elective" : "Core";
}
export function SubjectListDialog({
  subjects,
  pending,
  loadError,
  onClose,
}: {
  subjects: ScheduleSubject[];
  pending: boolean;
  loadError: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      needle === ""
        ? subjects
        : subjects.filter((s) =>
            `${s.name} ${s.code}`.toLowerCase().includes(needle),
          ),
    [subjects, needle],
  );
  return (
    <CardModal
      open
      onClose={onClose}
      size="md"
      title="Subjects"
      description={<>Grades 7–10 · {subjects.length} total</>}
      watchKey={pending}
    >
        <Input
          placeholder="Search name or code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search subjects"
        />
        {pending ? (
          <div className="grid gap-1.5" aria-busy="true" aria-label="Loading subjects">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-muted" />
            ))}
          </div>
        ) : loadError ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load subjects.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches.</p>
        ) : (
          <div
            className={`grid max-h-[50dvh] gap-1.5 overflow-y-auto pr-0.5 ${styles.noScrollbar}`}
            role="list"
            aria-label="Subjects"
          >
            {filtered.map((s) => (
              <div
                key={s.id}
                role="listitem"
                className="flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium">
                  {s.name} <span className="font-normal text-muted-foreground">({s.code})</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Grade {s.gradeLevel.replace("G", "")} · {categoryLabel(s.category)}
                </span>
              </div>
            ))}
          </div>
        )}
    </CardModal>
  );
}
