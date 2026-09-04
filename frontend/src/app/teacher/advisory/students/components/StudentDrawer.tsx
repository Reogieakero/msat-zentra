"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, FileText, Send, ClipboardList, Flag } from "lucide-react";
import {
  fetchAdviseeDetail,
  formatBirthdate,
  initialsOf,
  type AdviseeRow,
  type DrawerSection,
} from "./advisory-students-data";
import styles from "./StudentDrawer.module.css";

const RISK_VARIANT = "outline";

const FLAG_STATUS_VARIANTS = {
  open: "warning",
  escalated: "destructive",
  resolved: "success",
} as const;

interface StudentDrawerProps {
  studentId: string | null;
  rosterRow: AdviseeRow | null;
  focus: DrawerSection | null;
  onClose: () => void;
}

export function StudentDrawer({ studentId, rosterRow, focus, onClose }: StudentDrawerProps) {
  const isRosterOnly = rosterRow !== null && !rosterRow.hasAccount;
  const gradesRef = useRef<HTMLDivElement>(null);
  const attendanceRef = useRef<HTMLDivElement>(null);
  const anecdotalRef = useRef<HTMLDivElement>(null);

  const detailQuery = useQuery({
    queryKey: ["advisee-detail", studentId],
    queryFn: () => fetchAdviseeDetail(studentId!),
    enabled: studentId !== null && !isRosterOnly,
    retry: false,
  });
  const student = detailQuery.data ?? null;

  useEffect(() => {
    if (!student || !focus) return;
    const target =
      focus === "grades"
        ? gradesRef.current
        : focus === "attendance"
          ? attendanceRef.current
          : anecdotalRef.current;
    // Wait for the dialog to mount before scrolling.
    const t = window.setTimeout(() => {
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [student, focus]);

  return (
    <Dialog
      open={studentId !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className={styles.dialog}>
        {isRosterOnly && rosterRow ? (
          <>
            <DialogHeader className={styles.header}>
              <span className={styles.avatar} aria-hidden>
                {initialsOf(rosterRow.name)}
              </span>
              <div className={styles.titleWrap}>
                <div className={styles.titleRow}>
                  <DialogTitle className={styles.title}>{rosterRow.name}</DialogTitle>
                  <Badge variant="outline">No account</Badge>
                </div>
                <DialogDescription className={styles.subtitle}>
                  {rosterRow.lrn} · {rosterRow.section}
                </DialogDescription>
              </div>
            </DialogHeader>
            <p className={styles.notice}>
              Enlisted in the section roster — no login account yet. Grades,
              attendance, and case records appear here once the student registers
              and the account is approved.
            </p>
          </>
        ) : detailQuery.isPending || !student ? (
          <div className={styles.loading} aria-busy="true" aria-label="Loading student details">
            <div className={styles.loadingHead}>
              <Skeleton className={styles.skelAvatar} />
              <div className={styles.loadingTitle}>
                <Skeleton className={styles.skelTitle} />
                <Skeleton className={styles.skelSubtitle} />
              </div>
            </div>
            <Skeleton className={styles.skelBlock} />
            <Skeleton className={styles.skelBlock} />
          </div>
        ) : detailQuery.isError ? (
          <p className={styles.error}>Could not load student details.</p>
        ) : (
          <>
            <DialogHeader className={styles.header}>
              <span className={styles.avatar} aria-hidden>
                {initialsOf(student.name)}
              </span>
              <div className={styles.titleWrap}>
                <DialogTitle className={styles.title}>{student.name}</DialogTitle>
                <DialogDescription className={styles.subtitle}>
                  {student.lrn} · {formatBirthdate(student.birthdate)} · {student.gender ?? "—"} ·{" "}
                  {student.section}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div
              ref={gradesRef}
              className={`${styles.grades} ${focus === "grades" ? styles.focused : ""}`}
            >
              <p className={styles.sectionTitle}>Subject grades · read-only</p>
              {student.grades.length === 0 ? (
                <p className={styles.noGrades}>No grades encoded yet.</p>
              ) : (
                <ul className={styles.gradeList}>
                  {student.grades.map((g) => (
                    <li key={g.subject} className={styles.gradeRow}>
                      <span className={styles.gradeSubject}>{g.subject}</span>
                      <span className={styles.gradeScore}>
                        {g.transmutedGrade ?? "—"}
                        <span className={styles.gradeAvg}>
                          avg {g.computedAverage ?? "—"}
                        </span>
                      </span>
                      {g.remarks ? (
                        <Badge variant={g.remarks === "Passed" ? "success" : "destructive"}>
                          {g.remarks}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <dl className={styles.meta}>
              <div
                ref={attendanceRef}
                className={`${styles.metaRow} ${focus === "attendance" ? styles.focusedRow : ""}`}
              >
                <dt className={styles.metaLabel}>
                  <Clock className={styles.metaIcon} aria-hidden />
                  Attendance
                </dt>
                <dd className={styles.metaValue}>
                  {Math.round(student.attendance.rate * 100)}% · {student.attendance.present}P/
                  {student.attendance.absent}A/{student.attendance.late}L/
                  {student.attendance.excused}E
                </dd>
              </div>
              <div
                ref={anecdotalRef}
                className={`${styles.metaRow} ${focus === "anecdotal" ? styles.focusedRow : ""}`}
              >
                <dt className={styles.metaLabel}>
                  <FileText className={styles.metaIcon} aria-hidden />
                  Anecdotal
                </dt>
                <dd className={styles.metaValue}>
                  {student.anecdotal.count === 0
                    ? "None"
                    : `${student.anecdotal.count} on file · ${student.anecdotal.tiers.join(", ")}`}
                </dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>
                  <Send className={styles.metaIcon} aria-hidden />
                  Referrals
                </dt>
                <dd className={styles.metaValue}>
                  {student.referrals.length === 0
                    ? "None active"
                    : student.referrals.map((r) => `${r.target} (${r.status})`).join(", ")}
                </dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>
                  <ClipboardList className={styles.metaIcon} aria-hidden />
                  ADM case
                </dt>
                <dd className={styles.metaValue}>
                  {student.admCases.length === 0
                    ? "Not in pipeline"
                    : student.admCases.map((a) => a.stage).join(", ")}
                </dd>
              </div>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>
                  <Flag className={styles.metaIcon} aria-hidden />
                  Grade flags
                </dt>
                <dd className={styles.metaValue}>
                  {student.gradeFlags.length === 0
                    ? "None"
                    : student.gradeFlags.map((f) => `${f.reason} (${f.status})`).join(", ")}
                </dd>
              </div>
            </dl>

            {student.gradeFlags.length > 0 ? (
              <div className={styles.flags}>
                {student.gradeFlags.map((f) => (
                  <Badge
                    key={f.id}
                    variant={
                      FLAG_STATUS_VARIANTS[f.status as keyof typeof FLAG_STATUS_VARIANTS] ??
                      RISK_VARIANT
                    }
                  >
                    {f.reason} · {f.status}
                  </Badge>
                ))}
              </div>
            ) : null}

            <p className={styles.privacy}>
              Category-level info only — full write-ups stay with their owners.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
