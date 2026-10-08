"use client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClassAssessment, ClassStudent } from "@/services/teacher/grading.types";
import { ScoreCellInput, scoreOf } from "./score-input";
import styles from "./ScoreGrid.module.css";
export function PlainEncodeTable({ assessment, students, drafts, nameFilter, onDraftChange }: { assessment: ClassAssessment; students: ClassStudent[]; drafts: Record<string, string>; nameFilter: string; onDraftChange: (studentId: string, value: string) => void }) {
  const q = nameFilter.trim().toLowerCase();
  const rows = q ? students.filter((s) => s.name.toLowerCase().includes(q) || s.lrn.toLowerCase().includes(q)) : students;
  if (students.length === 0) {
    return <p className={styles.empty}>No students in this section yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="w-full table-fixed" aria-label={`Encode scores for ${assessment.title}`}>
        <TableHeader>
          <TableRow className="bg-muted/50 [&>th]:border-t-0">
            <TableHead style={{ width: 220 }}>Student</TableHead>
            <TableHead style={{ width: 140 }}>LRN</TableHead>
            <TableHead style={{ width: 130 }}>Score / {assessment.maxScore}</TableHead>
            <TableHead style={{ width: 100 }}>%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No students match your search.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((s) => {
              const savedText = assessment.scores[s.id] != null ? String(assessment.scores[s.id]) : "";
              const { num } = scoreOf(assessment, drafts, true, s.id);
              const shownNum = num ?? (savedText !== "" ? Number(savedText) : null);
              return (
                <TableRow key={s.id}>
                  <TableCell style={{ width: 220 }} className="truncate">
                    <p className={styles.cellMain}>{s.name}</p>
                  </TableCell>
                  <TableCell style={{ width: 140 }} className="truncate">
                    <span className={styles.lrnCell}>{s.lrn}</span>
                  </TableCell>
                  <TableCell style={{ width: 130 }} className="truncate">
                    <ScoreCellInput key={`${assessment.id}:${s.id}`} cacheKey={`${assessment.id}:${s.id}`} initial={drafts[s.id] ?? savedText} studentName={s.name} assessmentTitle={assessment.title} onDraft={(value) => onDraftChange(s.id, value)} />
                  </TableCell>
                  <TableCell style={{ width: 100 }} className="truncate">
                    <span className={styles.scorePct}>
                      {shownNum !== null && assessment.maxScore > 0 ? `${((shownNum / assessment.maxScore) * 100).toFixed(1)}%` : "—"}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
