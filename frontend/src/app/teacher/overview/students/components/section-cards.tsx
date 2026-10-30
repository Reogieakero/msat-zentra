"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { BookOpen, GraduationCap, Users } from "lucide-react";
import { Pill, type PillTone } from "@/components/ui/pill";
import type {
  AdvisorySectionItem,
  ClassPick,
  StudentListClassItem,
} from "@/services/teacher/studentList.types";
import styles from "./student-list.module.css";

const cardListVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.055, delayChildren: 0.05 },
  },
};

const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: "easeOut",
      // Cap the per-card delay so large lists still feel snappy.
      delay: Math.min(index * 0.055, 0.35),
    },
  }),
};

function SectionCardButton({
  active,
  title,
  meta,
  section,
  count,
  icon,
  onSelect,
  ariaLabel,
  index = 0,
  reduceMotion = false,
}: {
  active: boolean;
  title: string;
  meta: { label: string; tone: PillTone; ariaLabel: string }[];
  section?: string;
  count: number;
  icon: React.ReactNode;
  onSelect: () => void;
  ariaLabel: string;
  index?: number;
  reduceMotion?: boolean;
}) {
  return (
    <motion.li
      className="flex min-w-0"
      variants={cardItemVariants}
      custom={index}
      style={{ willChange: "transform, opacity" }}
    >
      <motion.button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-label={ariaLabel}
        initial={false}
        whileHover={reduceMotion ? undefined : { y: -2 }}
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        transition={{ type: "spring", stiffness: 400, damping: 28, mass: 0.6 }}
        className={`${styles.sectionCard} ${active ? styles.sectionCardActive : ""}`}
      >
        <span className={styles.sectionCardHead}>
          <span className={styles.sectionCardHeading}>
            <span className={styles.sectionCardName} title={title}>
              {title}
            </span>
            <span className={styles.sectionCardMetaRow}>
              {meta.map((tag) => (
                <Pill key={tag.label} tone={tag.tone} label={tag.ariaLabel}>
                  {tag.label}
                </Pill>
              ))}
              {section ? (
                <Pill tone="amber" label="Section">
                  {section}
                </Pill>
              ) : (
                <Pill tone="neutral" label="Students">
                  {count} Student{count === 1 ? "" : "s"}
                </Pill>
              )}
            </span>
          </span>
          <span className={styles.sectionCardIcon} aria-hidden>
            {icon}
          </span>
        </span>
        <span className={styles.sectionCardPanel}>
          <span className={styles.sectionCardStat}>
            <span className={styles.sectionCardStatIcon} aria-hidden>
              <Users />
            </span>
            <Pill
              tone="blue"
              label="Students"
              className={`${styles.sectionCardStatValue} tabular-nums`}
            >
              {count}
            </Pill>
            <span className={styles.sectionCardStatLabel}>
              Student{count === 1 ? "" : "s"}
            </span>
          </span>
        </span>
      </motion.button>
    </motion.li>
  );
}

export function SectionCards({
  advisorySections,
  classes,
  activePick,
  activeStudentCount,
  liveCountByKey,
  onSelect,
}: {
  advisorySections: AdvisorySectionItem[];
  classes: StudentListClassItem[];
  activePick: ClassPick | null;
  activeStudentCount: number;
  liveCountByKey: Map<string, number>;
  onSelect: (pick: ClassPick) => void;
}) {
  const empty = advisorySections.length === 0 && classes.length === 0;

  // Card counts come from real student lists when available (prefetched in
  // the background), falling back to the backend headcount until loaded.
  const resolveCount = (kind: ClassPick["kind"], id: string, headcount: number): number => {
    const live = liveCountByKey.get(`${kind}:${id}`);
    if (live !== undefined) return live;
    if (activePick?.kind === kind && activePick.id === id) return activeStudentCount;
    return headcount;
  };

  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section aria-label="Sections" className="flex min-w-0 flex-col gap-3">
      {empty ? (
        <p className="rounded-xl border border-border px-3 py-8 text-center text-xs text-muted-foreground">
          No sections match your search.
        </p>
      ) : (
        // Flat responsive grid — advisory and subject × section cards flow
        // horizontally like the principal academics section board instead of
        // stacking into grade/section kanban columns.
        <motion.ul
          className={styles.sectionCardGrid}
          variants={cardListVariants}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
        >
          {advisorySections.map((s, i) => {
            const active = activePick?.kind === "advisory" && activePick.id === s.id;
            const count = resolveCount("advisory", s.id, s.studentCount);
            return (
              <SectionCardButton
                key={`advisory:${s.id}`}
                index={i}
                reduceMotion={reduceMotion}
                active={active}
                title={s.name}
                meta={[
                  { label: "Advisory", tone: "blue", ariaLabel: "Section type" },
                  { label: s.gradeLevel, tone: "neutral", ariaLabel: "Grade level" },
                ]}
                count={count}
                icon={<GraduationCap size={13} aria-hidden />}
                onSelect={() => onSelect({ kind: "advisory", id: s.id })}
                ariaLabel={`Select advisory ${s.name}`}
              />
            );
          })}
          {classes.map((c, i) => {
            const active = activePick?.kind === "class" && activePick.id === c.id;
            const count = resolveCount("class", c.id, c.studentCount);
            return (
              <SectionCardButton
                key={`class:${c.id}`}
                index={advisorySections.length + i}
                reduceMotion={reduceMotion}
                active={active}
                title={c.subject}
                meta={[
                  { label: c.code, tone: "blue", ariaLabel: "Subject code" },
                  { label: c.gradeLevel, tone: "neutral", ariaLabel: "Grade level" },
                ]}
                section={c.section}
                count={count}
                icon={<BookOpen size={13} aria-hidden />}
                onSelect={() => onSelect({ kind: "class", id: c.id })}
                ariaLabel={`Select subject ${c.subject} in section ${c.section}`}
              />
            );
          })}
        </motion.ul>
      )}
    </section>
  );
}
