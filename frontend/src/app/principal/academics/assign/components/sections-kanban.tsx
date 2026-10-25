"use client";

import * as React from "react";
import {
  Check,
  Copy,
  GraduationCap,
  Inbox,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard, KanbanBoardEmpty } from "@/components/ui/kanban-board";
import type { GradeLevel, Section } from "@/services/principal/assign.types";
import { DropdownSelect } from "./DropdownSelect";
import { STATUS_META } from "./status-dots";
import styles from "./sections-kanban.module.css";

export const GRADES: GradeLevel[] = [7, 8, 9, 10, 11, 12];

const AWAITING_COLOR = "#d97706";

/** Card action buttons are a uniform 24px tall (h-6) with 11px labels. */
const CARD_BTN = "h-6 px-2 text-[11px]";
const CARD_ICON_BTN = "size-6";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

interface SectionsKanbanProps {
  sections: Section[];
  grade: GradeLevel | null;
  onGradeChange: (grade: GradeLevel | null) => void;
  schoolYearName: string;
  pendingIds: ReadonlySet<string>;
  /** Any board-wide mutation in flight — disables every card action. */
  busy: boolean;
  copiedCode: string | null;
  onCopyCode: (code: string) => void;
  onAssign: (section: Section) => void;
  onClear: (sectionId: string) => void;
  onRegenerate: (sectionId: string) => void;
  onDelete: (section: Section) => void;
  onCreate: () => void;
}

export function SectionsKanban({
  sections,
  grade,
  onGradeChange,
  schoolYearName,
  pendingIds,
  busy,
  copiedCode,
  onCopyCode,
  onAssign,
  onClear,
  onRegenerate,
  onDelete,
  onCreate,
}: SectionsKanbanProps) {
  const byGrade = React.useMemo(() => {
    const map = new Map<GradeLevel, Section[]>();
    for (const g of GRADES) map.set(g, []);
    for (const section of sections) {
      const lane = map.get(section.gradeLevel);
      if (lane) lane.push(section);
      else map.set(section.gradeLevel, [section]);
    }
    for (const lane of map.values()) lane.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [sections]);

  const assignedCount = React.useMemo(
    () => sections.filter((s) => s.adviserId || s.adviserName).length,
    [sections],
  );

  const lanes = grade == null ? GRADES : [grade];

  return (
    <div className={styles.board}>
      <KanbanBoard
        title="Section advisers"
        icon={
          <span className="text-primary" aria-hidden>
            <Users size={14} />
          </span>
        }
        count={sections.length}
        description={`School-wide (Grades 7–12) · ${schoolYearName || "active school year"} — ${assignedCount} of ${sections.length} sections with an adviser.`}
        ariaLabel="Section advisers board"
        actions={
          <div className="flex shrink-0 items-center gap-1.5">
            <DropdownSelect
              ariaLabel="Filter by grade level"
              value={grade != null ? String(grade) : "all"}
              onValueChange={(v) => onGradeChange(v === "all" ? null : (Number(v) as GradeLevel))}
              options={[
                { value: "all", label: "All grades" },
                ...GRADES.map((g) => ({ value: String(g), label: `Grade ${g}` })),
              ]}
              placeholder="All grades"
            />
            <Button size="xs" onClick={onCreate} disabled={busy}>
              <Plus size={13} aria-hidden />
              Assign Advisory
            </Button>
          </div>
        }
      >
        <div className={styles.lanes}>
          {lanes.map((g, laneIndex) => {
            const rows = byGrade.get(g) ?? [];
            return (
              <div
                key={g}
                className={styles.lane}
                style={{ animationDelay: `${Math.min(laneIndex, 6) * 40}ms` }}
              >
                <KanbanBoard
                  title={`Grade ${g}`}
                  icon={
                    <span className="text-primary" aria-hidden>
                      <GraduationCap size={14} />
                    </span>
                  }
                  count={rows.length}
                  ariaLabel={`Grade ${g} sections`}
                  boardLabel={`Grade ${g} lane`}
                  className="h-full bg-muted/60 dark:bg-muted/20"
                >
                  {rows.length === 0 ? (
                    <KanbanBoardEmpty>
                      <span className="flex flex-col items-center gap-1.5">
                        <Inbox size={16} aria-hidden />
                        No Grade {g} sections yet.
                      </span>
                    </KanbanBoardEmpty>
                  ) : (
                    <ul className={styles.laneBody} aria-label={`Grade ${g} sections`}>
                      {rows.map((s) => {
                        const pending = pendingIds.has(s.id);
                        const claimed = !!s.adviserId;
                        const awaitingClaim = !claimed && !!s.adviserName;
                        const code = s.adviserCode ?? "";
                        const rowBusy = pending || busy;

                        // A section that already carries learners or records
                        // cannot be changed, cleared, or deleted.
                        const linkedStudents = s.studentCount ?? 0;
                        const linkedRecords = s.recordCount ?? 0;
                        const hasLinks = linkedStudents + linkedRecords > 0;
                        const linkParts = [
                          linkedStudents > 0
                            ? `${linkedStudents} student${linkedStudents === 1 ? "" : "s"}`
                            : null,
                          linkedRecords > 0
                            ? `${linkedRecords} record${linkedRecords === 1 ? "" : "s"}`
                            : null,
                        ].filter(Boolean);
                        const linkSummary = linkParts.join(" · ");
                        const lockedHint = `Has ${linkSummary} — clear them first`;

                        return (
                          <li key={s.id} className={styles.card} aria-busy={pending || undefined}>
                            <div className={styles.cardTop}>
                              <span className={styles.avatar} aria-hidden>
                                {initialsOf(s.name)}
                              </span>
                              <div className={styles.cardId}>
                                <span className={styles.sectionName} title={s.name}>
                                  {s.name}
                                </span>
                                <span className={styles.teacher} title={s.adviserName || undefined}>
                                  {pending ? (
                                    <span className={styles.pendingWrap}>
                                      <Loader2 className={styles.pendingSpin} aria-hidden />
                                      {s.adviserName || "Assigning…"}
                                    </span>
                                  ) : s.adviserName ? (
                                    s.adviserName
                                  ) : (
                                    <span className={styles.teacherNone}>No adviser</span>
                                  )}
                                </span>
                              </div>
                              {claimed ? (
                                <span className={styles.claimMark}>
                                  <span
                                    className={styles.statusDot}
                                    style={{ backgroundColor: STATUS_META.progress.color }}
                                    aria-hidden
                                  />
                                  <span className={styles.claimLabel}>Claimed</span>
                                </span>
                              ) : awaitingClaim ? (
                                <span className={styles.claimMark}>
                                  <span
                                    className={styles.statusDot}
                                    style={{ backgroundColor: AWAITING_COLOR }}
                                    aria-hidden
                                  />
                                  <span className={styles.claimLabel}>Awaiting</span>
                                </span>
                              ) : null}
                            </div>

                            {awaitingClaim && code ? (
                              <>
                                <div className={styles.codeRow}>
                                  <code className={styles.code} title={code}>
                                    {code}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className={CARD_ICON_BTN}
                                    aria-label={`Copy advisory code for ${s.name}`}
                                    title="Copy advisory code"
                                    disabled={rowBusy}
                                    onClick={() => onCopyCode(code)}
                                  >
                                    {copiedCode === code ? (
                                      <Check size={12} aria-hidden />
                                    ) : (
                                      <Copy size={12} aria-hidden />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className={CARD_ICON_BTN}
                                    aria-label={`Regenerate advisory code for ${s.name}`}
                                    title="Mint a replacement code — the old one stops working"
                                    disabled={rowBusy}
                                    onClick={() => onRegenerate(s.id)}
                                  >
                                    <RefreshCw size={12} aria-hidden />
                                  </Button>
                                </div>
                                <span className={styles.codeHint}>
                                  Share with {s.adviserName} so they can claim the seat.
                                </span>
                              </>
                            ) : null}

                            {hasLinks ? (
                              <span className={styles.links}>
                                <Lock size={10} aria-hidden />
                                {linkSummary}
                              </span>
                            ) : null}

                            <div className={styles.cardActions}>
                              <Button
                                size="xs"
                                className={CARD_BTN}
                                aria-label={`Assign adviser for ${s.name}`}
                                title={
                                  claimed
                                    ? "Claimed by a teacher — locked"
                                    : hasLinks && s.adviserName
                                      ? lockedHint
                                      : undefined
                                }
                                disabled={rowBusy || claimed || (hasLinks && !!s.adviserName)}
                                onClick={() => onAssign(s)}
                              >
                                {s.adviserName ? "Change" : "Assign"}
                              </Button>
                              {awaitingClaim ? (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  className={CARD_BTN}
                                  aria-label={`Clear adviser for ${s.name}`}
                                  title={hasLinks ? lockedHint : "Clear the listed adviser and code"}
                                  disabled={rowBusy || hasLinks}
                                  onClick={() => onClear(s.id)}
                                >
                                  Clear
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                size="xs"
                                className={`${CARD_BTN} ${styles.deleteButton}`}
                                aria-label={`Delete ${s.name} section`}
                                title={
                                  claimed
                                    ? "Claimed by a teacher — locked"
                                    : hasLinks
                                      ? lockedHint
                                      : undefined
                                }
                                disabled={rowBusy || claimed || hasLinks}
                                onClick={() => onDelete(s)}
                              >
                                Delete
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </KanbanBoard>
              </div>
            );
          })}
        </div>
      </KanbanBoard>
    </div>
  );
}
