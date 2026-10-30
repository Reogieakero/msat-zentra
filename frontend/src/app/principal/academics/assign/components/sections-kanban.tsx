"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Inbox,
  Loader2,
  Plus,
  RefreshCw,
  Share2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { StudentMascot } from "@/components/student-mascot/StudentMascot";
import type { GradeLevel, Section } from "@/services/principal/assign.types";
import styles from "./sections-kanban.module.css";

export const GRADES: GradeLevel[] = [7, 8, 9, 10, 11, 12];

/** Card action buttons are a uniform 24px tall (h-6) with 11px labels. */
const CARD_BTN = "h-6 px-2 text-[11px]";
const CARD_ICON_BTN = "size-6";

const CLAIMED_AT_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatClaimedAt(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : CLAIMED_AT_FORMAT.format(date);
}

interface SectionsKanbanProps {
  sections: Section[];
  grade: GradeLevel | null;
  onGradeChange: (grade: GradeLevel | null) => void;
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
  // Flat, grade-sorted grid — no per-grade parent boards, no vertical lanes.
  const visibleSections = React.useMemo(() => {
    const rows = grade == null ? sections : sections.filter((s) => s.gradeLevel === grade);
    return [...rows].sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
      return a.name.localeCompare(b.name);
    });
  }, [sections, grade]);

  return (
    <section className={styles.board} aria-label="Section advisers">
      <header className={styles.toolbar}>
        <div className={styles.toolbarText}>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon} aria-hidden>
              <Users size={15} />
            </span>
            <h2 className={styles.title}>Section advisers</h2>
            <Pill tone="neutral" label="Sections">
              {sections.length}
            </Pill>
          </div>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Filter by grade level">
          <button
            type="button"
            role="tab"
            aria-selected={grade == null}
            className={styles.tab}
            onClick={() => onGradeChange(null)}
          >
            <Pill tone={grade == null ? "blue" : "neutral"} className={styles.tabPill}>
              All grades
            </Pill>
          </button>
          {GRADES.map((g) => {
            const active = grade === g;
            return (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={active}
                className={styles.tab}
                onClick={() => onGradeChange(g)}
              >
                <Pill tone={active ? "blue" : "neutral"} className={styles.tabPill}>
                  Grade {g}
                </Pill>
              </button>
            );
          })}
        </div>
        <div className={styles.toolbarEnd}>
          <Button size="xs" onClick={onCreate} disabled={busy}>
            <Plus size={13} aria-hidden />
            Assign Advisory
          </Button>
        </div>
      </header>

      {visibleSections.length === 0 ? (
        <div className={styles.emptyCard}>
          <Inbox size={18} aria-hidden />
          <span>
            {grade == null
              ? "No sections yet for this school year."
              : `No Grade ${grade} sections yet.`}
          </span>
        </div>
      ) : (
        <div className={styles.grid} aria-label="Sections" key={grade ?? "all"}>
          {visibleSections.map((s, index) => {
            const pending = pendingIds.has(s.id);
            const claimed = !!s.adviserId;
            const awaitingClaim = !claimed && !!s.adviserName;
            const code = s.adviserCode ?? "";
            const rowBusy = pending || busy;

            // A section that already carries learners or records cannot be
            // changed, cleared, or deleted. The counts stay backend-only.
            const hasLinks = (s.studentCount ?? 0) + (s.recordCount ?? 0) > 0;
            const lockedHint = "Has linked learners or records — clear them first";

            const adviserLabel = claimed ? s.adviserName : awaitingClaim ? s.adviserName : "";
            const claimedAtLabel = claimed ? formatClaimedAt(s.adviserClaimedAt) : null;

            return (
              <article
                key={s.id}
                className={styles.card}
                aria-busy={pending || undefined}
                aria-label={`${s.name} section adviser`}
                style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}
              >
                <header className={styles.cardHead}>
                  <StudentMascot
                    name={adviserLabel || s.name}
                    seed={s.adviserId || s.id}
                    size={38}
                  />
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
                  <Pill tone="neutral" label="Grade level" className={styles.gradePill}>
                    {`Grade ${s.gradeLevel}`}
                  </Pill>
                </header>

                <div className={styles.metaRow}>
                  {claimed ? (
                    <>
                      <Pill tone="green" label="Adviser status">
                        <Check size={11} aria-hidden />
                        Claimed
                      </Pill>

                      {/* The code stays visible for reference once claimed,
                          with copy only — no change/regenerate action. */}
                      {code ? (
                        <div className={styles.codeRow}>
                          <Pill tone="blue" label="Advisory code" className={styles.codePill}>
                            {code}
                          </Pill>
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
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {awaitingClaim ? (
                        <Pill tone="amber" label="Adviser status">
                          Awaiting claim
                        </Pill>
                      ) : (
                        <Pill tone="neutral" label="Adviser status">
                          Unassigned
                        </Pill>
                      )}

                      {/* Code + actions ride the same row as the status pill. */}
                      {awaitingClaim && code ? (
                        <div className={styles.codeRow}>
                          <Pill tone="blue" label="Advisory code" className={styles.codePill}>
                            {code}
                          </Pill>
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
                      ) : null}
                    </>
                  )}
                </div>

                {claimed ? (
                  <p className={`${styles.notice} ${styles.claimedNotice}`}>
                    <Check size={11} aria-hidden />
                    <span>
                      Claimed by <strong>{s.adviserName}</strong>
                      {claimedAtLabel ? <> on {claimedAtLabel}</> : null}.
                    </span>
                  </p>
                ) : awaitingClaim && code ? (
                  <p className={`${styles.notice} ${styles.claimNotice}`}>
                    <Share2 size={11} aria-hidden />
                    <span>
                      Share with <strong>{s.adviserName}</strong> so they can claim the seat.
                    </span>
                  </p>
                ) : null}

                {/* Claimed sections are locked — hide every action instead of
                    rendering disabled buttons. */}
                {!claimed ? (
                  <div className={styles.cardActions}>
                    <Button
                      size="xs"
                      className={CARD_BTN}
                      aria-label={`Assign adviser for ${s.name}`}
                      title={hasLinks && s.adviserName ? lockedHint : undefined}
                      disabled={rowBusy || (hasLinks && !!s.adviserName)}
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
                      title={hasLinks ? lockedHint : undefined}
                      disabled={rowBusy || hasLinks}
                      onClick={() => onDelete(s)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
