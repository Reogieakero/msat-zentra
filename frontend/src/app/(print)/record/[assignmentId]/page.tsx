"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { ArrowLeft, BookOpenText, ImageDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import { AmberRectPill } from "../../../teacher/classes/components/UnlinkCodeDialog";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import {
  COMPONENT_ORDER,
  computeSubjectGrade,
  gradeLabel,
  subjectEvidence,
} from "@/services/teacher/grading.compute";
import { fetchClassDetail } from "@/services/teacher/grading.service";
import { LockGradesButton } from "@/app/teacher/grading/[assignmentId]/components/LockGradesButton";
import { assignUniqueMascots } from "../../../teacher/grading/[assignmentId]/components/mascot-assignment";
import styles from "./record-sheet.module.css";

const SHORT: Record<string, string> = {
  WRITTEN_WORK: "WW",
  PERFORMANCE_TASK: "PT",
  EXAM: "E",
};

const CAT_HEAD: Record<string, string> = {
  WRITTEN_WORK: styles.catHeadWW,
  PERFORMANCE_TASK: styles.catHeadPT,
  EXAM: styles.catHeadE,
};

const CAT_SUB: Record<string, string> = {
  WRITTEN_WORK: styles.catSubWW,
  PERFORMANCE_TASK: styles.catSubPT,
  EXAM: styles.catSubE,
};

const CAT_AVG: Record<string, string> = {
  WRITTEN_WORK: styles.catAvgWW,
  PERFORMANCE_TASK: styles.catAvgPT,
  EXAM: styles.catAvgE,
};

const CAT_AVG_LABEL: Record<string, string> = {
  WRITTEN_WORK: "WW avg",
  PERFORMANCE_TASK: "PT avg",
  EXAM: "E avg",
};

export default function ClassRecordPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = params.assignmentId;
  const detailQuery = useQuery({
    queryKey: ["teacher-grading-class", assignmentId],
    queryFn: () => fetchClassDetail(assignmentId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const data = detailQuery.data;
  const students = data?.students ?? [];
  const components = data?.components ?? [];
  const gradeByStudent = new Map(
    students.map((s) => [s.id, computeSubjectGrade(subjectEvidence(components, s.id))]),
  );
  const mascotById = React.useMemo(() => assignUniqueMascots(students), [students]);
  const lockCount = students.filter((s) => s.final != null && s.final.lockStatus === "unlocked" && s.final.computedAverage != null).length;
  const exportRef = React.useRef<HTMLDivElement | null>(null);
  const tableWrapRef = React.useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = React.useState<"png" | "jpg" | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const saveImage = React.useCallback(
    async (format: "png" | "jpg") => {
      const node = exportRef.current;
      if (!node || exporting) return;
      setExporting(format);
      setExportError(null);
      const wrap = tableWrapRef.current;
      const prevOverflow = wrap?.style.overflow ?? "";
      try {
        // Expand the scroll container so the full table width is captured.
        if (wrap) wrap.style.overflow = "visible";
        const { toPng, toJpeg } = await import("html-to-image");
        // Exclude mascots from the exported image.
        const filter = (n: Node) => {
          if (n instanceof HTMLElement) {
            const label = n.getAttribute("aria-label") ?? "";
            if (label.includes("profile mascot")) return false;
          }
          return true;
        };
        const slug = (v: string) => v.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-");
        const ext = format === "png" ? "png" : "jpg";
        const dataUrl =
          format === "png"
            ? await toPng(node, { cacheBust: true, pixelRatio: 2, filter, backgroundColor: "#ffffff" })
            : await toJpeg(node, { cacheBust: true, pixelRatio: 2, quality: 0.95, filter, backgroundColor: "#ffffff" });
        const a = document.createElement("a");
        a.href = dataUrl;
        const subj = data ? slug(data.assignment.subjectCode) : "record";
        const sect = data ? slug(data.assignment.sectionName) : "section";
        a.download = `${subj}-${sect}-record.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        setExportError("Could not save the image. Try again.");
      } finally {
        if (wrap) wrap.style.overflow = prevOverflow;
        setExporting(null);
      }
    },
    [data, exporting],
  );

  if (detailQuery.isPending) {
    return (
      <section className={styles.page} aria-busy="true" aria-label="Loading class record">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-96 w-full" />
      </section>
    );
  }

  if (detailQuery.isError || !data) {
    return (
      <section className={styles.page}>
        <div className={styles.toolbar}>
          <Link href={`/teacher/grading/${assignmentId}`} className={styles.back}>
            <ArrowLeft className={styles.backIcon} />
            Back to workspace
          </Link>
        </div>
        <p className={styles.error}>Class record not found or you have no access to it.</p>
      </section>
    );
  }

  const { assignment } = data;

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <Link href={`/teacher/grading/${assignmentId}`} className={styles.back}>
          <ArrowLeft className={styles.backIcon} />
          Back to workspace
        </Link>
        <span className={styles.toolbarSpacer} />
        <span className="print:hidden">
          <LockGradesButton
            assignmentId={assignmentId}
            subjectLabel={`${assignment.subjectName} (${assignment.subjectCode}) — ${assignment.sectionName}`}
            termLabel={`Term ${assignment.termNumber}, ${assignment.schoolYear}`}
            unlockCount={lockCount}
            termId={assignment.termId}
            variant="default"
            className="h-6 px-3 text-xs"
          />
        </span>
        <Button
          variant="outline"
          onClick={() => void saveImage("png")}
          disabled={exporting !== null || students.length === 0}
          className="h-6 px-3 text-xs"
          aria-busy={exporting === "png" || undefined}
        >
          {exporting === "png" ? <Loader2 aria-hidden className="animate-spin" /> : <ImageDown aria-hidden />}
          Save PNG
        </Button>
        <Button
          variant="outline"
          onClick={() => void saveImage("jpg")}
          disabled={exporting !== null || students.length === 0}
          className="h-6 px-3 text-xs"
          aria-busy={exporting === "jpg" || undefined}
        >
          {exporting === "jpg" ? <Loader2 aria-hidden className="animate-spin" /> : <ImageDown aria-hidden />}
          Save JPG
        </Button>
      </div>
      {exportError ? (
        <p role="alert" className={styles.error}>
          {exportError}
        </p>
      ) : null}

      <div ref={exportRef}>
      <p className={styles.school}>Class Record — Grading Sheet</p>

      <KanbanBoard
        title={`${assignment.subjectName} (${assignment.subjectCode})`}
        icon={
          <span className="text-amber-500" aria-hidden>
            <BookOpenText size={14} />
          </span>
        }
        count={`${students.length} student${students.length === 1 ? "" : "s"}`}
        actions={
          <span className="flex flex-wrap items-center justify-end gap-1">
            <AmberRectPill>{assignment.sectionName}</AmberRectPill>
            <AmberRectPill>Grade {gradeLabel(assignment.gradeLevel)}</AmberRectPill>
            <AmberRectPill>Term {assignment.termNumber}</AmberRectPill>
            <AmberRectPill>{assignment.schoolYear}</AmberRectPill>
          </span>
        }
        ariaLabel="Class record grading sheet"
        boardLabel={`${assignment.subjectName}, ${assignment.sectionName}, ${students.length} students`}
        footer={
          <p className={styles.footnote}>
            Category averages use total-earned ÷ total-possible over encoded scores only.
            Categories with no assessments are excluded (N/A) and the remaining
            weights normalize to 100. Unencoded scores are not zeroes. Computed,
            Transmuted, and Remarks are calculated live from recorded assessments.
          </p>
        }
      >
        {students.length === 0 ? (
          <KanbanBoardEmpty>No students in this section yet.</KanbanBoardEmpty>
        ) : (
          <div ref={tableWrapRef} className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyCol} rowSpan={2}>
                    Student
                  </th>
                  {COMPONENT_ORDER.map((t) => {
                    const c = components.find((x) => x.type === t);
                    const n = c?.assessments.length ?? 0;
                    return (
                      <th key={t} colSpan={Math.max(n, 1)} className={CAT_HEAD[t] ?? ""}>
                        {SHORT[t]} · {c ? `${c.weight}%` : "—"}
                        {n === 0 ? " — No assessments (excluded)" : ""}
                      </th>
                    );
                  })}
                  {COMPONENT_ORDER.map((t) => (
                    <th key={`avg-${t}`} rowSpan={2} className={CAT_AVG[t] ?? ""}>
                      {CAT_AVG_LABEL[t] ?? ""}
                    </th>
                  ))}
                  <th rowSpan={2}>Computed</th>
                  <th rowSpan={2}>Transmuted</th>
                  <th rowSpan={2}>Remarks</th>
                </tr>
                <tr>
                  {COMPONENT_ORDER.map((t) => {
                    const list =
                      components.find((x) => x.type === t)?.assessments ?? [];
                    if (list.length === 0) return <th key={t} className={CAT_SUB[t] ?? ""}>—</th>;
                    return list.map((a) => (
                      <th key={a.id} className={CAT_SUB[t] ?? ""}>
                        {a.title}
                      </th>
                    ));
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const grade = gradeByStudent.get(s.id);
                  const avgOf = (t: string) => {
                    const pct = grade?.categories.find((c) => c.componentType === t)?.percentage;
                    return pct == null ? null : pct;
                  };

                  return (
                    <tr key={s.id}>
                      <th className={styles.stickyCol} scope="row">
                        <span className={styles.studentCell}>
                          <StudentMascot
                            name={s.name}
                            seed={s.lrn}
                            character={mascotById.get(s.id)}
                            size={28}
                          />
                          <span className={styles.studentText}>
                            <span className={styles.studentName} title={s.name}>
                              {s.name}
                            </span>
                            <span className={styles.lrnPill} title={s.lrn}>
                              {s.lrn}
                            </span>
                          </span>
                        </span>
                      </th>
                      {COMPONENT_ORDER.map((t) => {
                        const list =
                          components.find((x) => x.type === t)?.assessments ?? [];
                        if (list.length === 0) return <td key={t}>—</td>;
                        return list.map((a) => {
                          const raw = a.scores[s.id];
                          return (
                            <td key={a.id}>
                              {raw != null ? (
                                <>
                                  {raw}
                                  <span className={styles.cellSub}>
                                    {a.maxScore > 0 ? `${((raw / a.maxScore) * 100).toFixed(1)}%` : "—"}
                                  </span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        });
                      })}
                      {COMPONENT_ORDER.map((t) => (
                        <td key={`avg-${t}`} className={CAT_AVG[t] ?? ""}>
                          {avgOf(t)?.toFixed(1) ?? "N/A"}
                        </td>
                      ))}
                      <td className={styles.finalCol}>
                        {grade?.computedAverage != null ? grade.computedAverage.toFixed(2) : "—"}
                      </td>
                      <td className={styles.finalCol}>
                        {grade?.transmutedGrade != null ? grade.transmutedGrade.toFixed(0) : "—"}
                      </td>
                      <td className={styles.finalCol}>{grade?.remarks ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </KanbanBoard>
      </div>
    </section>
  );
}
