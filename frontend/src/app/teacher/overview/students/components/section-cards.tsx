"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { BookOpen, Users } from "lucide-react";
import type {
  AdvisorySectionItem,
  ClassPick,
  StudentListClassItem,
} from "@/services/teacher/studentList.types";

function ColumnHead({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div
      className="-mx-2.5 flex items-center justify-between gap-2 border-b border-border px-3.5 pb-2"
      aria-label={`${title}, ${count}`}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        {icon} <span className="truncate">{title}</span>
      </span>
      <span className="text-xs font-semibold text-muted-foreground">{count}</span>
    </div>
  );
}

function SectionCardButton({
  active,
  topLabel,
  topTone,
  bottomLabel,
  title,
  count,
  icon,
  onSelect,
  ariaLabel,
  index = 0,
  reduceMotion = false,
}: {
  active: boolean;
  topLabel: string;
  topTone: "blue" | "amber";
  bottomLabel: string;
  title: string;
  count: number;
  icon: React.ReactNode;
  onSelect: () => void;
  ariaLabel: string;
  index?: number;
  reduceMotion?: boolean;
}) {
  const topBadge =
    topTone === "blue"
      ? "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
      : "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";
  return (
    <motion.li
      className="flex h-auto min-w-0 flex-col"
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
        whileHover={reduceMotion ? undefined : { y: -3 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 28, mass: 0.6 }}
        className={`flex h-auto min-w-0 w-full cursor-pointer flex-col gap-1.5 rounded-lg border p-3 text-left shadow-sm transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-primary/60 hover:shadow-md dark:bg-card ${
          active
            ? "border-primary bg-white ring-1 ring-primary/30"
            : "border-border bg-white"
        }`}
      >
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span
            className={`inline-flex min-w-0 max-w-full items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${topBadge}`}
          >
            <span className="truncate" title={topLabel}>
              {topLabel}
            </span>
          </span>
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden
          >
            {icon}
          </span>
        </span>
        <span className="flex min-w-0 items-end justify-between gap-2">
          <span className="flex min-w-0 flex-col">
            <span className="text-[11px] font-medium text-muted-foreground">{bottomLabel}</span>
            <span
              className="break-words whitespace-normal text-sm font-semibold leading-snug line-clamp-2"
              title={title}
            >
              {title}
            </span>
          </span>
          <span
            className="flex shrink-0 items-baseline gap-1"
            title={`${count} student${count === 1 ? "" : "s"}`}
          >
            <span className="text-[32px] font-bold leading-none text-foreground">{count}</span>
            <span className="text-[11px] font-medium text-muted-foreground">
              student{count === 1 ? "" : "s"}
            </span>
          </span>
        </span>
      </motion.button>
    </motion.li>
  );
}

const columnListVariants: Variants = {
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
      // Cap the per-card delay so large sections still feel snappy.
      delay: Math.min(index * 0.055, 0.35),
    },
  }),
};

const columnVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: "easeOut",
      delay: Math.min(index * 0.07, 0.28),
    },
  }),
};

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

  const advisoryTotal = advisorySections.reduce(
    (sum, s) => sum + resolveCount("advisory", s.id, s.studentCount),
    0,
  );

  // Each handled section gets its own kanban column. Classes are the
  // subject × section pairs, so group them by section (name + grade) and
  // render one column per section instead of lumping every subject into a
  // single "Subjects" column.
  const classesBySection = new Map<string, StudentListClassItem[]>();
  for (const c of classes) {
    const key = `${c.gradeLevel}||${c.section}`;
    const list = classesBySection.get(key);
    if (list) list.push(c);
    else classesBySection.set(key, [c]);
  }
  const sectionGroups = [...classesBySection.entries()].map(([key, items]) => {
    const first = items[0];
    const sectionCount = resolveCount("class", first.id, first.studentCount);
    return { key, section: first.section, gradeLevel: first.gradeLevel, items, sectionCount };
  });

  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section aria-label="Sections" className="flex min-w-0 flex-col gap-3">
      {empty ? (
        <p className="rounded-xl border border-border px-3 py-8 text-center text-xs text-muted-foreground">
          No sections match your search.
        </p>
      ) : (
        <motion.div
          className="grid min-w-0 grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4"
          variants={columnListVariants}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
        >
          {advisorySections.length > 0 ? (
            <motion.div
              className="flex h-auto w-full min-w-0 flex-col gap-2 self-start rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
              aria-label={`Advisory, ${advisoryTotal} students`}
              variants={columnVariants}
              custom={0}
            >
              <ColumnHead
                icon={<Users size={14} aria-hidden className="text-blue-500" />}
                title="Advisory"
                count={advisoryTotal}
              />
              <motion.ul
                className="flex min-w-0 flex-col gap-2"
                variants={columnListVariants}
                initial={reduceMotion ? false : "hidden"}
                animate="show"
              >
                {advisorySections.map((s, i) => {
                  const active = activePick?.kind === "advisory" && activePick.id === s.id;
                  const count = resolveCount("advisory", s.id, s.studentCount);
                  return (
                    <SectionCardButton
                      key={s.id}
                      index={i}
                      reduceMotion={reduceMotion}
                      active={active}
                      topLabel={`Advisory · ${s.gradeLevel}`}
                      topTone="blue"
                      bottomLabel="Section name"
                      title={s.name}
                      count={count}
                      icon={<Users size={13} aria-hidden />}
                      onSelect={() => onSelect({ kind: "advisory", id: s.id })}
                      ariaLabel={`Select advisory ${s.name}`}
                    />
                  );
                })}
              </motion.ul>
            </motion.div>
          ) : null}

          {sectionGroups.length > 0
            ? sectionGroups.map((group, groupIndex) => (
                <motion.div
                  key={group.key}
                  className="flex h-auto w-full min-w-0 flex-col gap-2 self-start rounded-xl border border-border bg-muted/60 p-2.5 dark:bg-muted/20"
                  aria-label={`${group.section}, ${group.sectionCount} students`}
                  variants={columnVariants}
                  custom={groupIndex + (advisorySections.length > 0 ? 1 : 0)}
                >
                  <ColumnHead
                    icon={<BookOpen size={14} aria-hidden className="text-amber-500" />}
                    title={group.section}
                    count={group.sectionCount}
                  />
                  <motion.ul
                    className="flex min-w-0 flex-col gap-2"
                    variants={columnListVariants}
                    initial={reduceMotion ? false : "hidden"}
                    animate="show"
                  >
                    {group.items.map((c, i) => {
                      const active = activePick?.kind === "class" && activePick.id === c.id;
                      const count = resolveCount("class", c.id, c.studentCount);
                      return (
                        <SectionCardButton
                          key={c.id}
                          index={i}
                          reduceMotion={reduceMotion}
                          active={active}
                          topLabel={`${c.code} · ${c.gradeLevel}`}
                          topTone="amber"
                          bottomLabel="Subject name"
                          title={c.subject}
                          count={count}
                          icon={<BookOpen size={13} aria-hidden />}
                          onSelect={() => onSelect({ kind: "class", id: c.id })}
                          ariaLabel={`Select subject ${c.subject} in section ${c.section}`}
                        />
                      );
                    })}
                  </motion.ul>
                </motion.div>
              ))
            : null}
        </motion.div>
      )}
    </section>
  );
}
