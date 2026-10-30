"use client";

import * as React from "react";
import { Download, SearchIcon, Trophy } from "lucide-react";
import { PrincipalEmptyState } from "../../components/PrincipalEmptyCard";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { KanbanBoard } from "@/components/ui/kanban-board";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type { HonorRollCandidate } from "@/services/principal/honorRoll.types";
import { PAGE_SIZE, Pagination } from "@/components/shared/pagination";
import styles from "./CandidateTable.module.css";

interface Props {
  candidates: HonorRollCandidate[];
  grades: number[];
  activeGrade: string;
  onGradeChange: (grade: string) => void;
  loading?: boolean;
  /** Print metadata for the PDF export. */
  schoolYear?: string;
  termLabel?: string;
}

/** Grade-tab chips: 24px tall, blue when active (inactive stays neutral). */
const TAB_PILL_CLASS = "h-6 px-2.5";

const BAND_VARIANT: Record<string, PillTone> = {
  Advancing: "green",
  Benchmarking: "blue",
  Connecting: "amber",
  Developing: "red",
  Emerging: "red",
};

/** Subject-score tone: honour-roll grades are all ≥ 80, so 90+ is the highlight. */
function subjectTone(average: number): PillTone {
  if (average >= 92) return "green";
  if (average >= 88) return "blue";
  return "neutral";
}

export function CandidateTable({
  candidates,
  grades,
  activeGrade,
  onGradeChange,
  loading,
  schoolYear,
  termLabel,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const handleGradeSelect = (value: string) => {
    setPage(1);
    onGradeChange(value);
  };

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const base = needle
      ? candidates.filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            c.lrn.toLowerCase().includes(needle) ||
            c.section.toLowerCase().includes(needle),
        )
      : candidates;
    return [...base].sort((a, b) => b.overallAverage - a.overallAverage);
  }, [candidates, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const rankOffset = (safePage - 1) * PAGE_SIZE;

  const handleExport = async () => {
    if (candidates.length === 0) return;
    const ranked = candidates
      .slice()
      .sort((a, b) => b.overallAverage - a.overallAverage);

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 14;
    const tableW = pageW - M * 2;
    const HEAD_H = 8;
    const ROW_H = 7.5;
    const COLS = [
      { label: "Rank", w: 14 },
      { label: "Student", w: 60 },
      { label: "LRN", w: 30 },
      { label: "Section", w: 28 },
      { label: "Gen. Average", w: 24 },
      { label: "Band", w: 26 },
    ];

    // Title block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(17, 24, 39);
    doc.text("Honor Roll & Awards", M, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(
      "DO 15, s. 2026 Academic Excellence — general average >= 90, no subject below 80.",
      M,
      26,
    );
    const scope = activeGrade === "all" ? "All grade levels" : `Grade ${activeGrade}`;
    const meta = [schoolYear, termLabel, scope].filter(Boolean).join("  •  ");
    if (meta) doc.text(meta, M, 31);
    doc.text(`Generated ${new Date().toLocaleString()}`, pageW - M, 31, {
      align: "right",
    });

    const drawTableHead = (y: number) => {
      doc.setFillColor(30, 41, 59);
      doc.rect(M, y, tableW, HEAD_H, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      let x = M;
      for (const col of COLS) {
        doc.text(col.label, x + 2, y + 5.2);
        x += col.w;
      }
      doc.setTextColor(17, 24, 39);
      return y + HEAD_H;
    };

    let y = drawTableHead(38);
    ranked.forEach((c, i) => {
      if (y + ROW_H > pageH - M - 8) {
        doc.addPage();
        y = drawTableHead(M + 6);
      }
      const cells = [
        String(i + 1),
        c.name,
        c.lrn,
        c.section,
        c.overallAverage.toFixed(1),
        c.band,
      ];
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(M, y, tableW, ROW_H);
      let x = M;
      COLS.forEach((col, ci) => {
        if (ci > 0) doc.line(x, y, x, y + ROW_H);
        doc.setFont("helvetica", i < 3 ? "bold" : "normal");
        doc.setFontSize(8.5);
        doc.text(String(cells[ci]), x + 2, y + 4.9);
        x += col.w;
      });
      y += ROW_H;
    });

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p += 1) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 8, { align: "right" });
    }

    doc.save(
      `honor-roll-${activeGrade === "all" ? "all-grades" : `grade-${activeGrade}`}.pdf`,
    );
  };

  return (
    <KanbanBoard
      title={
        activeGrade === "all"
          ? "All grades — Academic Excellence"
          : `Grade ${activeGrade} — Academic Excellence`
      }
      style={{ borderRadius: "1rem" }}
      icon={
        <span className="text-amber-600 dark:text-amber-400" aria-hidden="true">
          <Trophy size={14} />
        </span>
      }
      description={
        candidates.length === 0
          ? "No adviser-shared awardees this term."
          : `${candidates.length} awardee${candidates.length === 1 ? "" : "s"} — live general average ≥ 90, no subject below 80. Counts only sections where the adviser shares student data.`
      }
      actions={
        <>
          <InputGroup className="max-w-40 shrink-0" style={{ borderRadius: "1rem" }}>
            <InputGroupInput
              placeholder="Filter students..."
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              aria-label="Filter students"
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={candidates.length === 0}
          >
            <Download className="size-3.5" /> Export
          </Button>
        </>
      }
      headerCenter={
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Filter by grade level"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeGrade === "all"}
            aria-label="All grades"
            title="All grades"
            className={styles.filterTab}
            onClick={() => handleGradeSelect("all")}
          >
            <Pill
              tone={activeGrade === "all" ? "blue" : "neutral"}
              className={TAB_PILL_CLASS}
            >
              All grades
            </Pill>
          </button>
          {grades.map((g) => {
            const key = String(g);
            const active = key === activeGrade;
            return (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Grade ${g}`}
                title={`Grade ${g}`}
                className={styles.filterTab}
                onClick={() => handleGradeSelect(key)}
              >
                <Pill
                  tone={active ? "blue" : "neutral"}
                  className={TAB_PILL_CLASS}
                >
                  Grade {g}
                </Pill>
              </button>
            );
          })}
        </div>
      }
      footer={
        filtered.length > 0 ? (
          <Pagination
            currentPage={safePage}
            totalItems={filtered.length}
            onPageChange={setPage}
          />
        ) : null
      }
    >
      {loading ? (
        <div className={styles.grid} aria-label="Loading honor roll" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <PrincipalEmptyState
          icon={Trophy}
          title="No awardees this term"
          hint="Students from adviser-shared sections with a live general average of 90+ and no subject below 80 will appear here as scores are recorded."
        />
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>No students match your search.</p>
      ) : (
        <div className={styles.grid} aria-label="Honor roll candidates">
          {pageRows.map((candidate, index) => (
            <CandidateCard
              key={candidate.studentId}
              candidate={candidate}
              rank={rankOffset + index + 1}
            />
          ))}
        </div>
      )}
    </KanbanBoard>
  );
}

/**
 * One awardee as its own mini kanban board: identity + live general average.
 * Hovering (or focusing) reveals the per-subject grades behind that average.
 */
function CandidateCard({
  candidate,
  rank,
}: {
  candidate: HonorRollCandidate;
  rank: number;
}) {
  return (
    <HoverCard openDelay={140} closeDelay={90}>
      <HoverCardTrigger asChild>
        <article className={styles.board} tabIndex={0}>
          <header className={styles.boardHead}>
            <StudentMascot
              name={candidate.name}
              seed={candidate.lrn}
              character={candidate.mascot ?? undefined}
              size={40}
            />
            <div className={styles.boardIdentity}>
              <p className={styles.boardName} title={candidate.name}>
                {candidate.name}
              </p>
              <Pill
                tone="neutral"
                label="LRN"
                className={`${styles.lrnPill} tabular-nums`}
              >
                {candidate.lrn}
              </Pill>
            </div>
            <span className={styles.rank}>#{rank}</span>
          </header>

          <div className={styles.boardPills}>
            <Pill tone="violet" label="Section">
              {candidate.section || "No section"}
            </Pill>
            <Pill tone="blue" label="Grade level">
              Grade {candidate.gradeLevel}
            </Pill>
          </div>

          <div className={styles.boardFoot}>
            <div className={styles.avgBlock}>
              <span className={styles.avgLabel}>General average</span>
              <span className={`${styles.avgValue} tabular-nums`}>
                {candidate.overallAverage.toFixed(1)}
              </span>
            </div>
            <Pill
              tone={BAND_VARIANT[candidate.band] ?? "neutral"}
              label="Descriptor band"
              className={styles.bandPill}
            >
              {candidate.band}
            </Pill>
          </div>
        </article>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        side="bottom"
        className={`${styles.hoverContent} w-72 p-0`}
      >
        <div className={styles.hoverBoard}>
          <header className={styles.hoverHead}>
            <StudentMascot
              name={candidate.name}
              seed={candidate.lrn}
              character={candidate.mascot ?? undefined}
              size={28}
            />
            <div className={styles.hoverTitleBlock}>
              <p className={styles.hoverName}>{candidate.name}</p>
              <p className={styles.hoverLrn}>{candidate.lrn}</p>
            </div>
            <Pill
              tone={BAND_VARIANT[candidate.band] ?? "neutral"}
              className="ml-auto tabular-nums"
            >
              {candidate.overallAverage.toFixed(1)}
            </Pill>
          </header>

          <div className={styles.hoverMeta}>
            <Pill tone="violet">{candidate.section || "No section"}</Pill>
            <Pill tone="blue">Grade {candidate.gradeLevel}</Pill>
          </div>

          {candidate.subjects.length > 0 ? (
            <ul className={styles.subjectList}>
              {candidate.subjects.map((subject) => (
                <li key={subject.code} className={styles.subjectRow}>
                  <span className={styles.subjectName} title={subject.subject}>
                    {subject.subject}
                  </span>
                  <Pill
                    tone={subjectTone(subject.average)}
                    className="tabular-nums"
                  >
                    {subject.average.toFixed(1)}
                  </Pill>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No subject grades recorded yet.</p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
