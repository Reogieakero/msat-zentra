"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import type { TeachingLoadSlot } from "@/services/teacher/reports.types";
import styles from "./reports.module.css";

/**
 * The old reports page body, kept as a collapsed card: load per section with
 * the submitted/approved state a teacher cannot see anywhere else.
 */
export function ReportsTeachingLoad({
  slots,
  loading,
}: {
  slots: TeachingLoadSlot[];
  loading: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  const approved = slots.filter((s) => s.status === "APPROVED").length;
  const submitted = slots.filter((s) => s.status === "SUBMITTED").length;

  const groups = React.useMemo(() => {
    const map = new Map<
      string,
      {
        section: { id: string; name: string; gradeLevel: string };
        subjects: Map<string, { name: string; code: string; approved: number; submitted: number }>;
      }
    >();
    for (const slot of [...slots].sort((a, b) => a.section.name.localeCompare(b.section.name))) {
      let entry = map.get(slot.section.id);
      if (!entry) {
        entry = { section: slot.section, subjects: new Map() };
        map.set(slot.section.id, entry);
      }
      const subject = entry.subjects.get(slot.subject.id) ?? {
        name: slot.subject.name,
        code: slot.subject.code,
        approved: 0,
        submitted: 0,
      };
      if (slot.status === "APPROVED") subject.approved += 1;
      else subject.submitted += 1;
      entry.subjects.set(slot.subject.id, subject);
    }
    return [...map.values()];
  }, [slots]);

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.loadToggle}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className={styles.cardTitle}>Teaching load</span>
          <span className={styles.cardSub} style={{ display: "block" }}>
            {loading
              ? "Loading committed slots…"
              : `${slots.length} slot${slots.length === 1 ? "" : "s"} · ${approved} approved · ${submitted} awaiting review`}
          </span>
        </span>
        <span className={styles.chips}>
          {open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
        </span>
      </button>

      {open ? (
        groups.length === 0 ? (
          <p className={styles.empty}>
            No committed slots yet. Your load appears once the master teacher schedules your sections.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.section.id} className={styles.loadGroup}>
              <span className={styles.loadSection}>
                {group.section.name}{" "}
                <span className={styles.loadSubject}>
                  · {group.section.gradeLevel.replace("G", "Grade ")}
                </span>
              </span>
              {[...group.subjects.values()].map((subject) => (
                <span key={subject.code} className={styles.loadSubject}>
                  {subject.name} ({subject.code}) · {subject.approved + subject.submitted} slot
                  {subject.approved + subject.submitted === 1 ? "" : "s"}
                  {subject.submitted > 0 ? (
                    <>
                      {" "}
                      <Pill tone="amber">{subject.submitted} awaiting review</Pill>
                    </>
                  ) : null}
                </span>
              ))}
            </div>
          ))
        )
      ) : null}
    </div>
  );
}
