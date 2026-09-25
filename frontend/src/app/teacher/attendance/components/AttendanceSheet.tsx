"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Search, Pencil, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  fetchSheetContext,
  fetchSheetMarks,
  submitSheet,
  initialsOf,
  type SheetStatus,
  type SheetSession,
} from "./attendance-taking-data";
import { sileo } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { SubmitConfirmDialog } from "./SubmitConfirmDialog";
import styles from "./AttendanceSheet.module.css";

const STATUSES: { value: SheetStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

interface AttendanceSheetProps {
  date: string;
  session: SheetSession;
  editable: boolean;
}

export function AttendanceSheet({ date, session, editable }: AttendanceSheetProps) {
  const queryClient = useQueryClient();
  const [marks, setMarks] = useState<Record<string, SheetStatus>>({});
  const [query, setQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sheetKey, setSheetKey] = useState(`${date}|${session}`);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A different date/session is a different sheet — drop local state.
  // (Render-phase reset: allowed because it is conditional on prop change.)
  if (sheetKey !== `${date}|${session}`) {
    setSheetKey(`${date}|${session}`);
    setMarks({});
    setQuery("");
    setSubmitted(false);
    setEditing(false);
    setConfirmOpen(false);
    setEditConfirmOpen(false);
    setSubmitError(null);
  }

  const contextQuery = useQuery({
    queryKey: ["attendance-sheet-context"],
    queryFn: fetchSheetContext,
    retry: false,
  });
  const marksQuery = useQuery({
    queryKey: ["attendance-sheet-marks", date, session],
    queryFn: () => fetchSheetMarks(`${date}T00:00:00Z`, session),
  });

  const students = useMemo(() => contextQuery.data?.students ?? [], [contextQuery.data]);
  const serverMarks = useMemo(() => marksQuery.data ?? {}, [marksQuery.data]);
  const loading = contextQuery.isPending || marksQuery.isPending;
  const loadError = contextQuery.isError || marksQuery.isError;
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
  }, [marks, serverMarks, students, date, session]);

  const needle = query.trim().toLowerCase();
  const visibleStudents = students.filter((s) => {
    if (!needle) return true;
    return s.name.toLowerCase().includes(needle) || s.lrn.includes(needle);
  });

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

  const sessionLabel = session === "AM" ? "Morning" : "Afternoon";
  const dateLabel = format(new Date(`${date}T00:00:00`), "MMM d, yyyy");
  const breakdown = STATUSES.filter((s) => counts[s.value] > 0)
    .map((s) => `${counts[s.value]} ${s.label.toLowerCase()}`)
    .join(", ");

  async function handleConfirm() {
    const ctx = contextQuery.data;
    if (!ctx || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitSheet({
        sectionId: ctx.sectionId,
        termId: ctx.termId,
        date: `${date}T00:00:00Z`,
        session,
        records: students.map((s) => ({ studentId: s.studentId, status: statusOf(s.studentId) })),
      });
      queryClient.invalidateQueries({ queryKey: ["attendance-sheet-marks"] });
      queryClient.invalidateQueries({ queryKey: ["advisory-students"] });
      setConfirmOpen(false);
      setSubmitted(true);
      setEditing(false);
      sileo.success({
        title: "Attendance saved",
        description: `${sessionLabel} attendance for ${dateLabel} — ${result.count} record${result.count === 1 ? "" : "s"}.`,
      });
    } catch {
      setConfirmOpen(false);
      setSubmitError("Could not submit attendance. Try again.");
      sileo.error({ title: "Could not submit attendance", description: "Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (showDone) {
    return (
      <>
        <Card className={styles.card}>
          <CardContent className={styles.success}>
            <CheckCircle2 className={styles.successIcon} aria-hidden />
            <p className={styles.successTitle}>
              {sessionLabel} attendance for {dateLabel} saved
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
        <AlertDialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit submitted marks?</AlertDialogTitle>
              <AlertDialogDescription>
                The sheet reopens with the submitted marks. Nothing changes on the
                server until you submit again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setEditing(true);
                  setSubmitted(false);
                }}
              >
                Edit marks
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <SubmitConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          sessionLabel={sessionLabel}
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
          <ul className={styles.rows} aria-busy="true" aria-label="Loading roster">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={styles.row} aria-hidden>
                <span className={styles.identity}>
                  <Skeleton className={styles.skelAvatar} />
                  <span className={styles.nameWrap}>
                    <Skeleton className={styles.skelName} />
                    <Skeleton className={styles.skelLrn} />
                  </span>
                </span>
                <span className={styles.segTabs} aria-hidden>
                  <Skeleton className={styles.skelSeg} />
                  <Skeleton className={styles.skelSeg} />
                  <Skeleton className={styles.skelSeg} />
                  <Skeleton className={styles.skelSeg} />
                </span>
              </li>
            ))}
          </ul>
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
          {dateLabel} · {sessionLabel} session · {students.length} advisees ·{" "}
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
            <>Submit {session === "AM" ? "morning" : "afternoon"} attendance</>
          )}
        </Button>
      </CardFooter>
    </Card>
    <SubmitConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      sessionLabel={sessionLabel}
      dateLabel={dateLabel}
      counts={counts}
      confirming={submitting}
      onConfirm={handleConfirm}
    />
    </>
  );
}
