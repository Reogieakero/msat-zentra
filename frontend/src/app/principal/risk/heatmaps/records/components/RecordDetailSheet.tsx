"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { X, FileText, TriangleAlert, Clock, CalendarDays } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { RecordStudent } from "../types";
import {
  CATEGORY_META,
  CATEGORY_KEYS,
  fetchRecords,
  titleCase,
} from "./records-data";
import styles from "./RecordDetailSheet.module.css";

type Severity = "Low" | "Moderate" | "High";
type FollowUp = "Pending" | "Resolved" | "Monitoring";

function severityTone(sev: Severity): string {
  return sev === "High"
    ? styles.sevHigh
    : sev === "Moderate"
      ? styles.sevModerate
      : styles.sevLow;
}

function followTone(f: FollowUp): string {
  return f === "Resolved"
    ? styles.followResolved
    : f === "Monitoring"
      ? styles.followMonitoring
      : styles.followPending;
}

function interpretCategoryBreakdown(
  rows: { label: string; value: number }[],
  total: number
): string {
  if (total === 0) return "No records on file.";
  if (rows.length === 1) {
    return `All ${total} record${total !== 1 ? "s" : ""} fall under ${rows[0].label.toLowerCase()}.`;
  }
  const top = rows[0];
  const pct = Math.round((top.value / total) * 100);
  const second = rows[1];
  const parts = [`${top.label} leads at ${pct}%`];
  if (second) {
    parts.push(`${second.label.toLowerCase()} follows at ${Math.round((second.value / total) * 100)}%`);
  }
  return `${parts.join(", ")}. ${total} total record${total !== 1 ? "s" : ""}.`;
}

export function RecordDetailSheet({
  lrn,
  onClose,
}: {
  lrn: string | null;
  onClose: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["records-heatmap"],
    queryFn: fetchRecords,
  });

  const student = React.useMemo(() => {
    if (!lrn || !data) return null;
    return (
      data.sections
        .flatMap((s) => s.students)
        .find((s) => s.lrn === lrn) ?? null
    );
  }, [data, lrn]);

  const categoryRows = React.useMemo(() => {
    if (!student) return [];
    const map = new Map<string, { label: string; color: string; value: number }>();
    for (const key of CATEGORY_KEYS) {
      map.set(key, {
        label: CATEGORY_META[key].label,
        color: CATEGORY_META[key].color,
        value: 0,
      });
    }
    for (const rec of student.behavioral) {
      const row = map.get(rec.category);
      if (row) row.value += 1;
    }
    return Array.from(map.values())
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [student]);

  const categoryTotal = categoryRows.reduce((s, r) => s + r.value, 0);
  const categoryInterpretation = interpretCategoryBreakdown(categoryRows, categoryTotal);

  const highCount = student?.behavioral.filter((r) => r.severity === "High").length ?? 0;
  const unresolvedCount =
    student?.behavioral.filter((r) => r.followUp !== "Resolved").length ?? 0;
  const lastRecordDate =
    student && student.behavioral.length > 0
      ? student.behavioral.reduce((a, r) => (r.date > a ? r.date : a), student.behavioral[0].date)
      : "—";

  return (
    <Sheet open={lrn !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" showCloseButton={false} className={styles.sheet}>
        {student && (
          <>
            <div className={styles.header}>
              <div className={styles.identity}>
                <div className={styles.initials}>{initials(student.name)}</div>
                <div className={styles.identityText}>
                  <SheetTitle className={styles.title}>{student.name}</SheetTitle>
                  <SheetDescription className={styles.sub}>
                    LRN {student.lrn} · {student.section}
                  </SheetDescription>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard}>
                <div className={`${styles.kpiIcon} ${styles.kpiDefault}`}>
                  <FileText size={16} aria-hidden />
                </div>
                <div className={styles.kpiBody}>
                  <span className={styles.kpiValue}>{student.behavioral.length}</span>
                  <span className={styles.kpiLabel}>Records</span>
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={`${styles.kpiIcon} ${styles.kpiWarn}`}>
                  <TriangleAlert size={16} aria-hidden />
                </div>
                <div className={styles.kpiBody}>
                  <span className={styles.kpiValue}>{highCount}</span>
                  <span className={styles.kpiLabel}>High severity</span>
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={`${styles.kpiIcon} ${styles.kpiWarn}`}>
                  <Clock size={16} aria-hidden />
                </div>
                <div className={styles.kpiBody}>
                  <span className={styles.kpiValue}>{unresolvedCount}</span>
                  <span className={styles.kpiLabel}>Unresolved</span>
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={`${styles.kpiIcon} ${styles.kpiDefault}`}>
                  <CalendarDays size={16} aria-hidden />
                </div>
                <div className={styles.kpiBody}>
                  <span className={styles.kpiValue}>{lastRecordDate}</span>
                  <span className={styles.kpiLabel}>Last record</span>
                </div>
              </div>
            </div>

            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Records by category</h3>
            </div>

            {categoryRows.length === 0 ? (
              <p className={styles.empty}>No records on file.</p>
            ) : (
              <div className={styles.catSection}>
                <div className={styles.catList}>
                  {categoryRows.map((row) => (
                    <div key={row.label} className={styles.catItem}>
                      <div className={styles.catTop}>
                        <span className={styles.catMeta}>
                          <span
                            className={styles.catDot}
                            style={{ backgroundColor: row.color }}
                            aria-hidden
                          />
                          <span className={styles.catLabel}>{row.label}</span>
                        </span>
                        <span className={styles.catValue}>{row.value}</span>
                      </div>
                      <span className={styles.catTrack}>
                        <span
                          className={styles.catFill}
                          style={{
                            width: `${(row.value / categoryTotal) * 100}%`,
                            backgroundColor: row.color,
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
                <p className={styles.catInterpretation}>{categoryInterpretation}</p>
              </div>
            )}

            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Behavioral records</h3>
            </div>

            {student.behavioral.length === 0 ? (
              <p className={styles.empty}>No behavioral records on file.</p>
            ) : (
              <ol className={styles.timeline}>
                {student.behavioral.map((rec) => (
                  <li key={rec.id} className={styles.timelineItem}>
                    <span className={styles.timelineDot} aria-hidden />
                    <div className={styles.timelineBody}>
                      <div className={styles.timelineTop}>
                        <span className={styles.timelineDate}>{rec.date}</span>
                        <span className={`${styles.sevTag} ${severityTone(rec.severity)}`}>
                          {rec.severity}
                        </span>
                      </div>
                      <p className={styles.timelineCat}>{titleCase(rec.category)}</p>
                      <p className={styles.timelineDesc}>{rec.description}</p>
                      <p className={styles.timelineNote}>
                        {rec.staff}
                        {rec.resolution ? ` · ${rec.resolution}` : ""}
                      </p>
                      <span className={`${styles.followTag} ${followTone(rec.followUp)}`}>
                        {rec.followUp}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function initials(name: string): string {
  return name
    .replace(/[^a-zA-Z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}
