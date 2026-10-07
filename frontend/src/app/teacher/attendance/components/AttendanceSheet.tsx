"use client";

import { useMemo, useState } from "react";
import { useTeacherInvalidate } from "../../components/use-teacher-invalidate";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Search, Pencil, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  submitSheet,
  useSheetContext,
  useSheetMarks,
} from "@/services/teacher/attendance.service";
import { initialsOf } from "@/lib/utils";
import type {
  SheetContext,
  SheetStatus,
} from "@/services/teacher/attendance.types";
import { sileo } from "@/components/ui/sonner";
import { CardModal } from "@/components/ui/CardModal";
import { SubmitConfirmDialog } from "./SubmitConfirmDialog";
import { SheetRowsSkeleton } from "./attendance-skeleton";
import styles from "./AttendanceSheet.module.css";

const STATUSES: { value: SheetStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

interface AttendanceSheetProps {
  date: string;
  subjectId: string | undefined;
  assignmentId: string | undefined;
  slot: number;
  subjectLabel: string;
  editable: boolean;
  /** Explicit section roster (code-claimed flow). When provided, the sheet
   *  reads students + section/term from it instead of the advisory context. */
  roster?: { ctx: SheetContext | null; pending: boolean; error: boolean };
}

export function AttendanceSheet({
  date,
  subjectId,
  assignmentId,
  slot,
  subjectLabel,
  editable,
  roster,
}: AttendanceSheetProps) {
  const invalidateTeacher = useTeacherInvalidate();
  const [marks, setMarks] = useState<Record<string, SheetStatus>>({});
  const [query, setQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sheetKey, setSheetKey] = useState(`${date}|${subjectId ?? "none"}|${slot}`);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A different date/subject/period is a different sheet — drop local state.
  // (Render-phase reset: allowed because it is conditional on prop change.)
  if (sheetKey !== `${date}|${subjectId ?? "none"}|${slot}`) {
    setSheetKey(`${date}|${subjectId ?? "none"}|${slot}`);
    setMarks({});
    setQuery("");
    setSubmitted(false);
    setEditing(false);
    setConfirmOpen(false);
    setEditConfirmOpen(false);
    setSubmitError(null);
  }

  const contextQuery = useSheetContext();
  const effectiveCtx = roster ? roster.ctx : (contextQuery.data ?? null);
  const marksQuery = useSheetMarks(date, subjectId, slot, effectiveCtx?.sectionId ?? null);

  const students = useMemo(() => effectiveCtx?.students ?? [], [effectiveCtx]);
  const serverMarks = useMemo(() => marksQuery.data ?? {}, [marksQuery.data]);
  const loading = (roster ? roster.pending : contextQuery.isPending) || marksQuery.isPending;
  const loadError = (roster ? roster.error : contextQuery.isError) || marksQuery.isError;
  // Done persists across refresh: submitted sheets have server-side marks,
  // so a sheet with existing marks opens on the done panel until edited.
  const serverSubmitted = Object.keys(serverMarks).length > 0;
  const showDone = !loading && (submitted || serverSubmitted) && !editing;

  const statusOf = (studentId: string): SheetStatus =>
    marks[studentId] ?? serverMarks[studentId] ?? "present";

  const counts = useMemo(() => {
    const c: Record<SheetStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const s of students) c[statusOf(s.studentId)] += 1;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, serverMarks, students, date, subjectId, slot]);

  const needle = query.trim().toLowerCase();
  const visibleStudents = useMemo(() => {
    if (!needle) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(needle) || s.lrn.includes(needle),
    );
  }, [students, needle]);

  function setAll(status: SheetStatus) {
    setMarks((prev) => {
      const next = { ...prev };
      for (const s of students) next[s.studentId] = status;
      return next;
    });
    setSubmitted(false);
    setEditing(true);
    setSubmitError(null);
  }

  const contextLabel =
    slot > 1 ? `${subjectLabel} · Period ${slot}` : subjectLabel;
  const dateLabel = format(new Date(`${date}T00:00:00`), "MMM d, yyyy");
  const breakdown = STATUSES.filter((s) => counts[s.value] > 0)
    .map((s) => `${counts[s.value]} ${s.label.toLowerCase()}`)
    .join(", ");

  async function handleConfirm() {
    const ctx = roster ? roster.ctx : contextQuery.data;
    if (!ctx || !subjectId || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitSheet({
        sectionId: ctx.sectionId,
        termId: ctx.termId,
        date: `${date}T00:00:00Z`,
        subjectId,
        assignmentId,
        slot,
        records: students.map((s) => ({ studentId: s.studentId, status: statusOf(s.studentId) })),
      });
      invalidateTeacher.marks();
      setConfirmOpen(false);
      setSubmitted(true);
      setEditing(false);
      sileo.success({
        title: "Attendance saved",
        description: `${contextLabel} for ${dateLabel} — ${result.count} record${result.count === 1 ? "" : "s"}.`,
      });
    } catch {
      setConfirmOpen(false);
      setSubmitError("Could not submit attendance. Try again.");
      sileo.error({ title: "Could not submit attendance", description: "Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!subjectId) {
    return (
      <Card className={styles.card}>
        <CardContent className={styles.success}>
          <p className={styles.successTitle}>Select a subject to take attendance</p>
          <p className={styles.successSub}>
            {loading
              ? "Loading your offered subjects…"
              : "No offered subjects found for this section and term."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (showDone) {
    return (
      <>
        <Card className={styles.card}>
          <CardContent className={styles.success}>
            <CheckCircle2 className={styles.successIcon} aria-hidden />
            <p className={styles.successTitle}>
              {contextLabel} for {dateLabel} saved
            </p>
            <p className={styles.successSub}>{breakdown}.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditConfirmOpen(true)}
            >
              <Pencil aria-hidden />
              Edit marks
            </Button>
          </CardContent>
        </Card>
        <CardModal
          open={editConfirmOpen}
          onClose={() => setEditConfirmOpen(false)}
          size="sm"
          title="Edit submitted marks?"
          description="The sheet reopens with the submitted marks. Nothing changes on the server until you submit again."
        >
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setEditConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditing(true);
                setSubmitted(false);
              }}
            >
              Edit marks
            </Button>
          </div>
        </CardModal>
        <SubmitConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          contextLabel={contextLabel}
          dateLabel={dateLabel}
          counts={counts}
          confirming={submitting}
          onConfirm={handleConfirm}
        />
      </>
    );
  }

  return (
    <>
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <div className={styles.headerActions}>
          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or LRN…"
              aria-label="Search advisees"
              className={styles.search}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className={styles.markAllBtn}
            onClick={() => setAll("present")}
            disabled={!editable || loading}
          >
            Mark all present
          </Button>
        </div>
      </CardHeader>

      <CardContent className={styles.content}>
        {loading ? (
          <SheetRowsSkeleton />
        ) : loadError ? (
          <p className={styles.empty}>
            Could not load your roster. Check your connection and try again.
          </p>
        ) : visibleStudents.length === 0 ? (
          <p className={styles.empty}>
            {needle ? `No advisees match "${query}".` : "No advisees."}
          </p>
        ) : (
        <ul className={styles.rows}>
          {visibleStudents.map((s) => (
            <li key={s.studentId} id={`sheet-row-${s.studentId}`} className={styles.row}>
              <span className={styles.identity}>
                <span className={styles.avatar} aria-hidden>
                  {initialsOf(s.name)}
                </span>
                <span className={styles.nameWrap}>
                  <span className={styles.name}>{s.name}</span>
                  <span className={styles.lrn}>{s.lrn}</span>
                </span>
              </span>
              <div
                className={styles.segTabs}
                role="group"
                aria-label={`Attendance for ${s.name}`}
              >
                {STATUSES.map((st) => {
                  const active = statusOf(s.studentId) === st.value;
                  return (
                    <Button
                      key={st.value}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "ghost"}
                      disabled={!editable || submitting}
                      onClick={() => {
                        setMarks((prev) => ({ ...prev, [s.studentId]: st.value }));
                        setSubmitted(false);
                        setSubmitError(null);
                      }}
                    >
                      {st.label}
                    </Button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        )}

        {submitError ? (
          <p className={styles.submitError} role="alert">
            {submitError}
          </p>
        ) : null}
        {!editable ? (
          <p className={styles.locked} role="note">
            Days before this week are locked — only this week can be submitted.
          </p>
        ) : null}
      </CardContent>

      <CardFooter className={styles.footer}>
        <span className={styles.footerInfo}>
          {dateLabel} · {contextLabel} · {students.length} advisees ·{" "}
          {contextQuery.data?.sectionName ?? ""}
        </span>
        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={!editable || loading || submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Submitting…
            </>
          ) : (
            <>Submit {subjectLabel} attendance</>
          )}
        </Button>
      </CardFooter>
    </Card>
    <SubmitConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      contextLabel={contextLabel}
      dateLabel={dateLabel}
      counts={counts}
      confirming={submitting}
      onConfirm={handleConfirm}
    />
    </>
  );
}
